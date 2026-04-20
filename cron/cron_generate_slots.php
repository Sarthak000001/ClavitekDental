<?php
/**
 * Cron Job: Generate Doctor Slots
 * 
 * This script extends doctor availability by generating slots for the next 30 days.
 * It runs once every 30 days and appends new slots without modifying existing ones.
 * 
 * Execution:
 * - First run: Generates slots from first day of current month to last day of current month
 * - Subsequent runs: Generates slots for the entire next calendar month
 * 
 * Requirements:
 * - Only generates slots from doctor_weekly_slots
 * - Only for active doctors and active weekly slots
 * - Respects unique constraint (doctor_id, slot_date, start_time, end_time)
 * - Idempotent (safe to re-run)
 * 
 * Security:
 * - HTTP Basic Authentication required for web access
 * - CLI execution does not require authentication
 * - Change default credentials before production deployment
 */

// Include database configuration
require_once __DIR__ . '/../api/config.php';

// Cron endpoint authentication credentials
// For production, set these via environment variables or config
define('CRON_AUTH_USERNAME', getenv('CRON_AUTH_USERNAME') ?: 'admin');
define('CRON_AUTH_PASSWORD', getenv('CRON_AUTH_PASSWORD') ?: 'cron_secure_pass_2024');

// HTTP Basic Authentication function
function checkCronAuth() {
    if (php_sapi_name() === 'cli') {
        // CLI execution doesn't require authentication
        return true;
    }
    
    $username = null;
    $password = null;
    
    // Try to get credentials from server variables (works with Apache)
    if (isset($_SERVER['PHP_AUTH_USER']) && isset($_SERVER['PHP_AUTH_PW'])) {
        $username = $_SERVER['PHP_AUTH_USER'];
        $password = $_SERVER['PHP_AUTH_PW'];
    }
    // Try HTTP_AUTHORIZATION header (works with Nginx/PHP-FPM)
    elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth = $_SERVER['HTTP_AUTHORIZATION'];
        if (preg_match('/Basic\s+(.*)$/i', $auth, $matches)) {
            $credentials = base64_decode($matches[1]);
            if ($credentials !== false) {
                list($username, $password) = explode(':', $credentials, 2);
            }
        }
    }
    // Try REDIRECT_HTTP_AUTHORIZATION (some server configs)
    elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $auth = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        if (preg_match('/Basic\s+(.*)$/i', $auth, $matches)) {
            $credentials = base64_decode($matches[1]);
            if ($credentials !== false) {
                list($username, $password) = explode(':', $credentials, 2);
            }
        }
    }
    
    // Verify credentials
    if ($username === CRON_AUTH_USERNAME && $password === CRON_AUTH_PASSWORD) {
        return true;
    }
    
    // Authentication failed - send 401 response
    header('WWW-Authenticate: Basic realm="Cron Job Authentication"');
    http_response_code(401);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Authentication required. Invalid credentials.'
    ]);
    exit;
}

// Check authentication for HTTP requests only
if (php_sapi_name() !== 'cli') {
    checkCronAuth();
}

// Logging function
function logMessage($message, $type = 'INFO') {
    $timestamp = date('Y-m-d H:i:s');
    $logEntry = "[$timestamp] [$type] $message" . PHP_EOL;
    
    // Output to console
    echo $logEntry;
    
    // Optionally write to log file
    $logFile = __DIR__ . '/cron_generate_slots.log';
    file_put_contents($logFile, $logEntry, FILE_APPEND);
}

// Get database connection (without session)
function getDBCron() {
    try {
        $pdo = new PDO(
            "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false
            ]
        );
        return $pdo;
    } catch(PDOException $e) {
        logMessage("Database connection failed: " . $e->getMessage(), 'ERROR');
        throw $e;
    }
}

// Map MySQL DAYNAME() to ENUM values
function getDayOfWeekEnum($dayName) {
    $mapping = [
        'Monday' => 'MONDAY',
        'Tuesday' => 'TUESDAY',
        'Wednesday' => 'WEDNESDAY',
        'Thursday' => 'THURSDAY',
        'Friday' => 'FRIDAY',
        'Saturday' => 'SATURDAY',
        'Sunday' => 'SUNDAY'
    ];
    return $mapping[$dayName] ?? null;
}

/**
 * Main slot generation function
 */
function generateDoctorSlots() {
    $pdo = getDBCron();
    
    try {
        // Start transaction
        $pdo->beginTransaction();
        
        logMessage("=== Starting Slot Generation Process ===");
        
        // Step 1: Find the maximum slot_date in doctor_slots
        $stmt = $pdo->query("SELECT MAX(slot_date) as max_date FROM doctor_slots");
        $result = $stmt->fetch();
        $maxDate = $result['max_date'];
        
        // Determine start date and end date
        $startDate = null;
        $isFirstRun = ($maxDate === null);
        
        if ($isFirstRun) {
            // First run: Start from first day of current month
            $startDate = new DateTime('first day of this month');
            // First run: End at last day of current month
            $endDate = new DateTime('last day of this month');
            logMessage("First run detected. Starting from first day of current month: " . $startDate->format('Y-m-d'));
        } else {
            // Subsequent runs: Start from next day after max date
            $startDate = new DateTime($maxDate);
            $startDate->modify('+1 day');
            logMessage("Found existing slots. Maximum date: $maxDate. Starting from: " . $startDate->format('Y-m-d'));
            
            // Step 2: Calculate end date (end of next full calendar month from start date)
            // If start_date is in month M, generate until end of month M+1
            $endDate = clone $startDate;
            // Move to first day of next month, then get last day of that month
            $endDate->modify('first day of next month');
            $endDate->modify('last day of this month');
        }
        
        // Create DatePeriod that includes the end date (exclusive, so add 1 day)
        $periodEndDate = clone $endDate;
        $periodEndDate->modify('+1 day');
        
        logMessage("Generation range: " . $startDate->format('Y-m-d') . " to " . $endDate->format('Y-m-d') . " (inclusive)");
        
        // Step 3: Fetch all active doctors with their weekly slots (both active and inactive)
        // Slots will be generated with the same is_active status as their weekly slot template
        $stmt = $pdo->query("
            SELECT 
                w.id as weekly_slot_id,
                w.doctor_id,
                w.day_of_week,
                w.start_time,
                w.end_time,
                w.max_capacity,
                w.is_active,
                d.doctor_name
            FROM doctor_weekly_slots w
            INNER JOIN doctors d ON w.doctor_id = d.id
            WHERE d.is_active = 1
            ORDER BY w.doctor_id, w.day_of_week, w.start_time
        ");
        $weeklySlots = $stmt->fetchAll();
        
        if (empty($weeklySlots)) {
            logMessage("No weekly slots found. Nothing to generate.", 'WARNING');
            $pdo->rollBack();
            return [
                'success' => false,
                'message' => 'No weekly slots found',
                'slots_generated' => 0
            ];
        }
        
        $activeCount = count(array_filter($weeklySlots, function($slot) { return $slot['is_active']; }));
        $inactiveCount = count($weeklySlots) - $activeCount;
        logMessage("Found " . count($weeklySlots) . " weekly slot configurations ($activeCount active, $inactiveCount inactive)");
        
        // Step 4: Generate slots for each day in the range
        $slotsToInsert = [];
        $datePeriod = new DatePeriod(
            $startDate,
            new DateInterval('P1D'),
            $periodEndDate
        );
        
        $daysProcessed = 0;
        foreach ($datePeriod as $date) {
            $dateString = $date->format('Y-m-d');
            $dayName = $date->format('l'); // e.g., "Monday", "Tuesday"
            $dayOfWeekEnum = getDayOfWeekEnum($dayName);
            
            if ($dayOfWeekEnum === null) {
                logMessage("Unknown day name: $dayName for date $dateString", 'WARNING');
                continue;
            }
            
            // Find weekly slots for this day of week
            foreach ($weeklySlots as $weeklySlot) {
                if ($weeklySlot['day_of_week'] === $dayOfWeekEnum) {
                    $slotsToInsert[] = [
                        'doctor_id' => $weeklySlot['doctor_id'],
                        'slot_date' => $dateString,
                        'start_time' => $weeklySlot['start_time'],
                        'end_time' => $weeklySlot['end_time'],
                        'max_capacity' => $weeklySlot['max_capacity'],
                        'is_active' => (bool)$weeklySlot['is_active'] // Preserve the is_active status from weekly slot
                    ];
                }
            }
            $daysProcessed++;
        }
        
        logMessage("Processed $daysProcessed days. Prepared " . count($slotsToInsert) . " slots for insertion");
        
        // Step 5: Batch insert slots (using INSERT IGNORE to skip duplicates)
        if (empty($slotsToInsert)) {
            logMessage("No slots to insert.", 'WARNING');
            $pdo->rollBack();
            return [
                'success' => false,
                'message' => 'No slots to insert',
                'slots_generated' => 0
            ];
        }
        
        $insertStmt = $pdo->prepare("
            INSERT IGNORE INTO doctor_slots 
            (doctor_id, slot_date, start_time, end_time, max_capacity, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        
        $insertedCount = 0;
        $skippedCount = 0;
        
        foreach ($slotsToInsert as $slot) {
            try {
                $result = $insertStmt->execute([
                    $slot['doctor_id'],
                    $slot['slot_date'],
                    $slot['start_time'],
                    $slot['end_time'],
                    $slot['max_capacity'],
                    $slot['is_active'] ? 1 : 0
                ]);
                
                if ($insertStmt->rowCount() > 0) {
                    $insertedCount++;
                } else {
                    $skippedCount++; // Duplicate or constraint violation
                }
            } catch (PDOException $e) {
                // Skip on duplicate key (shouldn't happen with INSERT IGNORE, but just in case)
                if (strpos($e->getMessage(), 'Duplicate entry') === false) {
                    throw $e;
                }
                $skippedCount++;
            }
        }
        
        // Commit transaction
        $pdo->commit();
        
        // Calculate final end date for logging
        $finalEndDate = clone $periodEndDate;
        $finalEndDate->modify('-1 day');
        
        // Log audit event
        try {
            $pdo->beginTransaction();
            $auditStmt = $pdo->prepare("
                INSERT INTO system_audit_logs 
                (event_type, reference_id, reference_table, event_description) 
                VALUES (?, ?, ?, ?)
            ");
            $auditStmt->execute([
                'SLOT_GENERATION',
                null,
                'doctor_slots',
                "Cron job generated $insertedCount slots from " . $startDate->format('Y-m-d') . " to " . $finalEndDate->format('Y-m-d') . ". Skipped $skippedCount duplicates."
            ]);
            $pdo->commit();
        } catch (Exception $e) {
            logMessage("Failed to log audit event: " . $e->getMessage(), 'WARNING');
            $pdo->rollBack();
        }
        
        logMessage("=== Slot Generation Completed Successfully ===");
        logMessage("Slots inserted: $insertedCount");
        logMessage("Slots skipped (duplicates): $skippedCount");
        logMessage("Start date: " . $startDate->format('Y-m-d'));
        logMessage("End date: " . $finalEndDate->format('Y-m-d'));
        
        return [
            'success' => true,
            'message' => 'Slots generated successfully',
            'start_date' => $startDate->format('Y-m-d'),
            'end_date' => $finalEndDate->format('Y-m-d'),
            'slots_generated' => $insertedCount,
            'slots_skipped' => $skippedCount,
            'days_processed' => $daysProcessed
        ];
        
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        logMessage("Error generating slots: " . $e->getMessage(), 'ERROR');
        logMessage("Stack trace: " . $e->getTraceAsString(), 'ERROR');
        
        return [
            'success' => false,
            'message' => 'Error: ' . $e->getMessage(),
            'slots_generated' => 0
        ];
    }
}

// Execute if run directly (not included)
if (php_sapi_name() === 'cli' || basename($_SERVER['PHP_SELF']) === 'cron_generate_slots.php') {
    try {
        $result = generateDoctorSlots();
        
        if (php_sapi_name() === 'cli') {
            // CLI output
            exit($result['success'] ? 0 : 1);
        } else {
            // HTTP output for testing
            header('Content-Type: application/json');
            echo json_encode($result, JSON_PRETTY_PRINT);
        }
    } catch (Exception $e) {
        logMessage("Fatal error: " . $e->getMessage(), 'ERROR');
        if (php_sapi_name() === 'cli') {
            exit(1);
        } else {
            http_response_code(500);
            header('Content-Type: application/json');
            echo json_encode([
                'success' => false,
                'message' => 'Fatal error: ' . $e->getMessage()
            ]);
        }
    }
}
