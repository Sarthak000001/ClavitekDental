<?php
require_once 'config.php';
checkAuth();

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// GET - List doctors or get weekly slots
if ($method === 'GET') {
    if ($action === 'weekly_slots') {
        // Get weekly slots for a doctor
        $doctorId = $_GET['doctor_id'] ?? 0;
        
        if (!$doctorId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Doctor ID required']);
            exit;
        }
        
        $stmt = $pdo->prepare("
            SELECT id, doctor_id, day_of_week, start_time, end_time, max_capacity, is_active, created_at, updated_at
            FROM doctor_weekly_slots
            WHERE doctor_id = ?
            ORDER BY FIELD(day_of_week, 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'), start_time
        ");
        $stmt->execute([$doctorId]);
        $slots = $stmt->fetchAll();
        
        echo json_encode([
            'success' => true,
            'data' => $slots
        ]);
        exit;
    }
    
    if ($action === 'get_weekly_slot') {
        // Get a single weekly slot
        $slotId = $_GET['id'] ?? 0;
        
        if (!$slotId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Slot ID required']);
            exit;
        }
        
        $stmt = $pdo->prepare("
            SELECT id, doctor_id, day_of_week, start_time, end_time, max_capacity, is_active, created_at, updated_at
            FROM doctor_weekly_slots
            WHERE id = ?
        ");
        $stmt->execute([$slotId]);
        $slot = $stmt->fetch();
        
        if ($slot) {
            echo json_encode([
                'success' => true,
                'data' => $slot
            ]);
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Slot not found']);
        }
        exit;
    }
    
    // Default: List all doctors
    try {
        // Check which columns exist in the doctors table
        $columns = $pdo->query("SHOW COLUMNS FROM doctors")->fetchAll(PDO::FETCH_COLUMN);
        
        // Build SELECT clause based on available columns
        $selectFields = ['id', 'doctor_name', 'specialization', 'is_active', 'created_at'];
        
        if (in_array('practice_area', $columns)) {
            $selectFields[] = 'practice_area';
        }
        if (in_array('phone', $columns)) {
            $selectFields[] = 'phone';
        }
        if (in_array('email', $columns)) {
            $selectFields[] = 'email';
        }
        
        $fieldsList = implode(', ', $selectFields);
        
        // Check if doctor_weekly_slots table exists
        $tables = $pdo->query("SHOW TABLES LIKE 'doctor_weekly_slots'")->fetchAll();
        $hasWeeklySlotsTable = !empty($tables);
        
        // Get doctors with active slots count if table exists
        if ($hasWeeklySlotsTable) {
            $sql = "SELECT 
                        $fieldsList,
                        (SELECT COUNT(*) 
                         FROM doctor_weekly_slots 
                         WHERE doctor_id = doctors.id 
                         AND is_active = 1) as active_slots_count
                    FROM doctors
                    ORDER BY doctor_name";
        } else {
            $sql = "SELECT 
                        $fieldsList,
                        0 as active_slots_count
                    FROM doctors
                    ORDER BY doctor_name";
        }
        $stmt = $pdo->query($sql);
        $doctors = $stmt->fetchAll();
        
        // Ensure all expected fields are present with default values
        foreach ($doctors as &$doctor) {
            if (!isset($doctor['practice_area'])) $doctor['practice_area'] = null;
            if (!isset($doctor['phone'])) $doctor['phone'] = null;
            if (!isset($doctor['email'])) $doctor['email'] = null;
            if (!isset($doctor['active_slots_count'])) $doctor['active_slots_count'] = 0;
        }
        unset($doctor); // Break reference
        
        echo json_encode([
            'success' => true,
            'data' => $doctors
        ]);
        exit;
    } catch (PDOException $e) {
        // Check if it's a table doesn't exist error
        if (strpos($e->getMessage(), "doesn't exist") !== false || strpos($e->getMessage(), 'Table') !== false) {
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Database table not found. Please run the database schema migration first.'
            ]);
        } else {
            http_response_code(500);
            error_log('Doctors API Error: ' . $e->getMessage());
            echo json_encode([
                'success' => false,
                'message' => 'Database error occurred. Please check server logs for details.'
            ]);
        }
        exit;
    }
}

/**
 * Propagate changes from weekly slot to upcoming date-specific slots
 * 
 * Updates all upcoming slots (slot_date >= CURDATE()) that match:
 * - doctor_id
 * - start_time
 * - end_time
 * - day_of_week matches slot_date
 * 
 * @param PDO $pdo Database connection
 * @param int $weeklySlotId Weekly slot ID
 * @param array $updates Array with 'max_capacity' and/or 'is_active' to update
 * @return array Result with updated_count, appointment_warnings
 */
function propagateWeeklySlotChanges($pdo, $weeklySlotId, $updates) {
    try {
        // Get the weekly slot details
        $stmt = $pdo->prepare("
            SELECT doctor_id, day_of_week, start_time, end_time
            FROM doctor_weekly_slots
            WHERE id = ?
        ");
        $stmt->execute([$weeklySlotId]);
        $weeklySlot = $stmt->fetch();
        
        if (!$weeklySlot) {
            return [
                'success' => false,
                'message' => 'Weekly slot not found',
                'updated_count' => 0
            ];
        }
        
        // Map day of week ENUM to day name
        $dayMapping = [
            'MONDAY' => 'Monday',
            'TUESDAY' => 'Tuesday',
            'WEDNESDAY' => 'Wednesday',
            'THURSDAY' => 'Thursday',
            'FRIDAY' => 'Friday',
            'SATURDAY' => 'Saturday',
            'SUNDAY' => 'Sunday'
        ];
        $dayName = $dayMapping[$weeklySlot['day_of_week']] ?? null;
        
        if (!$dayName) {
            return [
                'success' => false,
                'message' => 'Invalid day of week',
                'updated_count' => 0
            ];
        }
        
        // Build UPDATE query
        $updateFields = [];
        $updateParams = [];
        
        if (isset($updates['max_capacity'])) {
            $updateFields[] = 'max_capacity = ?';
            $updateParams[] = $updates['max_capacity'];
        }
        
        if (isset($updates['is_active'])) {
            $updateFields[] = 'is_active = ?';
            $updateParams[] = $updates['is_active'] ? 1 : 0;
        }
        
        if (empty($updateFields)) {
            return [
                'success' => true,
                'message' => 'No fields to update',
                'updated_count' => 0
            ];
        }
        
        // Check for existing appointments before updating
        // IMPORTANT: Only check for BOOKED appointments
        // COMPLETED, CANCELLED, and NO_SHOW appointments do NOT block updates (only shown as warnings)
        // Match: doctor_id, start_time, end_time, and day_of_week matches slot_date
        // Fix collation mismatch by using COLLATE for DAYNAME() comparison
        $appointmentCheck = $pdo->prepare("
            SELECT 
                ds.slot_date,
                COUNT(a.id) as appointment_count
            FROM doctor_slots ds
            LEFT JOIN appointments a ON ds.id = a.slot_id 
                AND a.appointment_status = 'BOOKED'  -- Only count BOOKED appointments
            WHERE ds.doctor_id = ?
                AND ds.start_time = ?
                AND ds.end_time = ?
                AND ds.slot_date >= CURDATE()
                AND DAYNAME(ds.slot_date) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
            GROUP BY ds.slot_date
            HAVING appointment_count > 0  -- Only return dates with BOOKED appointments
        ");
        $appointmentCheck->execute([
            $weeklySlot['doctor_id'],
            $weeklySlot['start_time'],
            $weeklySlot['end_time'],
            $dayName
        ]);
        $appointments = $appointmentCheck->fetchAll();
        
        $warnings = [];
        if (!empty($appointments)) {
            $totalAppointments = array_sum(array_column($appointments, 'appointment_count'));
            foreach ($appointments as $apt) {
                $warnings[] = [
                    'date' => $apt['slot_date'],
                    'count' => (int)$apt['appointment_count']
                ];
            }
        }
        
        // Update upcoming slots using bulk UPDATE
        // Match: doctor_id, start_time, end_time, day_of_week matches slot_date
        // Fix collation mismatch by using COLLATE for DAYNAME() comparison
        $updateQuery = "
            UPDATE doctor_slots
            SET " . implode(', ', $updateFields) . "
            WHERE doctor_id = ?
                AND start_time = ?
                AND end_time = ?
                AND slot_date >= CURDATE()
                AND DAYNAME(slot_date) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
        ";
        
        $updateParams[] = $weeklySlot['doctor_id'];
        $updateParams[] = $weeklySlot['start_time'];
        $updateParams[] = $weeklySlot['end_time'];
        $updateParams[] = $dayName;
        
        $updateStmt = $pdo->prepare($updateQuery);
        $updateStmt->execute($updateParams);
        $updatedCount = $updateStmt->rowCount();
        
        return [
            'success' => true,
            'updated_count' => $updatedCount,
            'appointment_warnings' => $warnings,
            'total_appointments' => $totalAppointments ?? 0
        ];
        
    } catch (Exception $e) {
        error_log("Error propagating weekly slot changes: " . $e->getMessage());
        return [
            'success' => false,
            'message' => 'Error: ' . $e->getMessage(),
            'updated_count' => 0
        ];
    }
}

/**
 * Generate date-specific slots from a weekly slot template
 * 
 * Generates slots from today to the maximum slot_date in doctor_slots
 * Only generates for dates matching the weekly slot's day_of_week
 * 
 * @param PDO $pdo Database connection
 * @param array $weeklySlot Weekly slot data (doctor_id, day_of_week, start_time, end_time, max_capacity, is_active)
 * @return array Result with slots_generated count
 */
function generateSlotsFromWeeklySlot($pdo, $weeklySlot) {
    try {
        // Step 1: Check if doctor_slots has any records
        $stmt = $pdo->query("SELECT MAX(slot_date) as max_date FROM doctor_slots");
        $result = $stmt->fetch();
        $maxDate = $result['max_date'];
        
        // If doctor_slots is empty, don't generate anything (let cron handle initial population)
        if ($maxDate === null) {
            return [
                'success' => true,
                'slots_generated' => 0,
                'message' => 'No existing slots found. Cron will handle initial generation.'
            ];
        }
        
        // Step 2: Determine generation range
        // Note: Generated slots will have the same is_active status as their weekly slot template
        $startDate = new DateTime(); // Today
        $startDate->setTime(0, 0, 0); // Normalize to midnight for date-only comparison
        
        // End date: Last date of the month containing the maximum slot_date
        $maxDateObj = new DateTime($maxDate);
        $endDate = clone $maxDateObj;
        $endDate->modify('last day of this month'); // Last day of the month containing max_date
        $endDate->setTime(0, 0, 0); // Normalize to midnight
        
        // Don't generate if end_date (last day of max month) is before today
        if ($endDate < $startDate) {
            return [
                'success' => true,
                'slots_generated' => 0,
                'message' => 'Maximum slot date month is in the past. No slots generated.'
            ];
        }
        
        // Step 3: Map day names to ENUM values
        $dayMapping = [
            'Monday' => 'MONDAY',
            'Tuesday' => 'TUESDAY',
            'Wednesday' => 'WEDNESDAY',
            'Thursday' => 'THURSDAY',
            'Friday' => 'FRIDAY',
            'Saturday' => 'SATURDAY',
            'Sunday' => 'SUNDAY'
        ];
        
        // Step 4: Generate slots for matching dates
        $slotsToInsert = [];
        $datePeriod = new DatePeriod(
            $startDate,
            new DateInterval('P1D'),
            (clone $endDate)->modify('+1 day') // Include end date
        );
        
        foreach ($datePeriod as $date) {
            $dateString = $date->format('Y-m-d');
            $dayName = $date->format('l'); // e.g., "Monday", "Tuesday"
            $dayOfWeekEnum = $dayMapping[$dayName] ?? null;
            
            // Check if date's day_of_week matches the weekly slot
            if ($dayOfWeekEnum === $weeklySlot['day_of_week']) {
                $slotsToInsert[] = [
                    'doctor_id' => $weeklySlot['doctor_id'],
                    'slot_date' => $dateString,
                    'start_time' => $weeklySlot['start_time'],
                    'end_time' => $weeklySlot['end_time'],
                    'max_capacity' => $weeklySlot['max_capacity'],
                    'is_active' => isset($weeklySlot['is_active']) ? (bool)$weeklySlot['is_active'] : false // Preserve the is_active status from weekly slot
                ];
            }
        }
        
        if (empty($slotsToInsert)) {
            return [
                'success' => true,
                'slots_generated' => 0,
                'message' => 'No matching dates found in the range.'
            ];
        }
        
        // Step 5: Insert slots using INSERT IGNORE to skip duplicates
        $insertStmt = $pdo->prepare("
            INSERT IGNORE INTO doctor_slots 
            (doctor_id, slot_date, start_time, end_time, max_capacity, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        
        $insertedCount = 0;
        $skippedCount = 0;
        
        foreach ($slotsToInsert as $slot) {
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
        }
        
        return [
            'success' => true,
            'slots_generated' => $insertedCount,
            'slots_skipped' => $skippedCount,
            'message' => "Generated $insertedCount slots (skipped $skippedCount duplicates)"
        ];
        
    } catch (Exception $e) {
        // Log error but don't fail the weekly slot creation
        error_log("Error generating slots from weekly slot: " . $e->getMessage());
        return [
            'success' => false,
            'slots_generated' => 0,
            'message' => 'Error generating slots: ' . $e->getMessage()
        ];
    }
}

// POST - Create weekly slot
if ($method === 'POST' && $action === 'weekly_slots') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $doctorId = $data['doctor_id'] ?? 0;
    $dayOfWeek = $data['day_of_week'] ?? '';
    $startTime = $data['start_time'] ?? '';
    $endTime = $data['end_time'] ?? '';
    $maxCapacity = $data['max_capacity'] ?? 10;
    $isActive = $data['is_active'] ?? true;
    
    if (!$doctorId || !$dayOfWeek || !$startTime || !$endTime) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }
    
    // Validate time range
    if ($startTime >= $endTime) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'End time must be after start time']);
        exit;
    }
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO doctor_weekly_slots (doctor_id, day_of_week, start_time, end_time, max_capacity, is_active)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$doctorId, $dayOfWeek, $startTime, $endTime, $maxCapacity, $isActive ? 1 : 0]);
        
        $slotId = $pdo->lastInsertId();
        
        logAudit($pdo, 'WEEKLY_SLOT_CREATED', $slotId, 'doctor_weekly_slots', 
                 "Weekly slot created for doctor $doctorId on $dayOfWeek");
        
        // Generate date-specific slots from the newly created weekly slot
        $slotGenerationResult = generateSlotsFromWeeklySlot($pdo, [
            'doctor_id' => $doctorId,
            'day_of_week' => $dayOfWeek,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'max_capacity' => $maxCapacity,
            'is_active' => $isActive
        ]);
        
        $responseMessage = 'Weekly slot created successfully';
        if ($slotGenerationResult['slots_generated'] > 0) {
            $responseMessage .= '. ' . $slotGenerationResult['message'];
        }
        
        echo json_encode([
            'success' => true,
            'message' => $responseMessage,
            'id' => $slotId,
            'slots_generated' => $slotGenerationResult['slots_generated'],
            'slots_skipped' => $slotGenerationResult['slots_skipped'] ?? 0
        ]);
    } catch (PDOException $e) {
        http_response_code(400);
        if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
            echo json_encode(['success' => false, 'message' => 'A slot with this time already exists for this day']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Failed to create slot: ' . $e->getMessage()]);
        }
    }
    exit;
}

// PUT - Update doctor status or weekly slot
if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if ($action === 'toggle_weekly_slot') {
        // Toggle weekly slot status
        $id = $data['id'] ?? 0;
        $isActive = $data['is_active'] ?? false;
        
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Slot ID required']);
            exit;
        }
        
        try {
            $pdo->beginTransaction();
            
            // Update weekly slot
            $stmt = $pdo->prepare("UPDATE doctor_weekly_slots SET is_active = ? WHERE id = ?");
            $stmt->execute([$isActive ? 1 : 0, $id]);
            
            // Propagate changes to upcoming slots
            $propagationResult = propagateWeeklySlotChanges($pdo, $id, ['is_active' => $isActive]);
            
            $pdo->commit();
            
            logAudit($pdo, 'WEEKLY_SLOT_STATUS_CHANGED', $id, 'doctor_weekly_slots', 
                     "Weekly slot " . ($isActive ? 'activated' : 'deactivated') . ". Updated {$propagationResult['updated_count']} upcoming slots.");
            
            $response = [
                'success' => true,
                'message' => 'Slot status updated',
                'slots_updated' => $propagationResult['updated_count'] ?? 0
            ];
            
            // Add appointment warnings if any
            if (!empty($propagationResult['appointment_warnings'])) {
                $response['warning'] = "There are already {$propagationResult['total_appointments']} appointments on upcoming dates. You can still mark this slot inactive.";
                $response['appointment_details'] = $propagationResult['appointment_warnings'];
            }
            
            echo json_encode($response);
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Failed to update slot: ' . $e->getMessage()
            ]);
        }
        exit;
    }
    
    if ($action === 'weekly_slots') {
        // Update weekly slot (only max_capacity and is_active are editable)
        $id = $data['id'] ?? 0;
        $maxCapacity = $data['max_capacity'] ?? null;
        $isActive = isset($data['is_active']) ? (bool)$data['is_active'] : null;
        
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Slot ID required']);
            exit;
        }
        
        // Get current weekly slot to preserve non-editable fields
        $getStmt = $pdo->prepare("
            SELECT doctor_id, day_of_week, start_time, end_time, max_capacity, is_active
            FROM doctor_weekly_slots
            WHERE id = ?
        ");
        $getStmt->execute([$id]);
        $currentSlot = $getStmt->fetch();
        
        if (!$currentSlot) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Weekly slot not found']);
            exit;
        }
        
        // Use current values if not provided
        $maxCapacity = $maxCapacity !== null ? $maxCapacity : $currentSlot['max_capacity'];
        $isActive = $isActive !== null ? $isActive : $currentSlot['is_active'];
        
        try {
            $pdo->beginTransaction();
            
            // Update weekly slot (only max_capacity and is_active)
            $stmt = $pdo->prepare("
                UPDATE doctor_weekly_slots 
                SET max_capacity = ?, is_active = ?
                WHERE id = ?
            ");
            $stmt->execute([$maxCapacity, $isActive ? 1 : 0, $id]);
            
            // Determine what changed for propagation
            $updates = [];
            $changedFields = [];
            
            if ($maxCapacity != $currentSlot['max_capacity']) {
                $updates['max_capacity'] = $maxCapacity;
                $changedFields[] = 'max_capacity';
            }
            
            if ($isActive != $currentSlot['is_active']) {
                $updates['is_active'] = $isActive;
                $changedFields[] = 'is_active';
            }
            
            // Propagate changes to upcoming slots if anything changed
            $propagationResult = ['updated_count' => 0, 'appointment_warnings' => []];
            if (!empty($updates)) {
                $propagationResult = propagateWeeklySlotChanges($pdo, $id, $updates);
            }
            
            $pdo->commit();
            
            $changedMsg = !empty($changedFields) ? ' (' . implode(', ', $changedFields) . ')' : '';
            logAudit($pdo, 'WEEKLY_SLOT_UPDATED', $id, 'doctor_weekly_slots', 
                     "Weekly slot updated{$changedMsg}. Updated {$propagationResult['updated_count']} upcoming slots.");
            
            $response = [
                'success' => true,
                'message' => 'Weekly slot updated successfully',
                'slots_updated' => $propagationResult['updated_count'] ?? 0
            ];
            
            // Add appointment warnings if any
            if (!empty($propagationResult['appointment_warnings'])) {
                $response['warning'] = "There are already {$propagationResult['total_appointments']} appointments on upcoming dates.";
                $response['appointment_details'] = $propagationResult['appointment_warnings'];
            }
            
            echo json_encode($response);
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(400);
            if (strpos($e->getMessage(), 'Duplicate entry') !== false) {
                echo json_encode(['success' => false, 'message' => 'A slot with this time already exists for this day']);
            } else {
                echo json_encode(['success' => false, 'message' => 'Failed to update slot: ' . $e->getMessage()]);
            }
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'Failed to update slot: ' . $e->getMessage()]);
        }
        exit;
    }
    
    // Default: Toggle doctor status
    $id = $data['id'] ?? 0;
    $isActive = $data['is_active'] ?? false;
    
    $stmt = $pdo->prepare("UPDATE doctors SET is_active = ? WHERE id = ?");
    $stmt->execute([$isActive ? 1 : 0, $id]);
    
    logAudit($pdo, 'DOCTOR_STATUS_CHANGED', $id, 'doctors', 
             "Doctor " . ($isActive ? 'enabled' : 'disabled'));
    
    echo json_encode([
        'success' => true,
        'message' => 'Doctor status updated'
    ]);
    exit;
}

/**
 * Check if upcoming slots have appointments before deletion
 * 
 * @param PDO $pdo Database connection
 * @param int $weeklySlotId Weekly slot ID
 * @return array Result with has_appointments flag and appointment details
 */
function checkUpcomingSlotsForAppointments($pdo, $weeklySlotId) {
    try {
        if (!$pdo) {
            return [
                'success' => false,
                'message' => 'Database connection not available',
                'has_appointments' => false,
                'appointments' => [],
                'total_appointments' => 0
            ];
        }
        
        if (empty($weeklySlotId) || !is_numeric($weeklySlotId)) {
            return [
                'success' => false,
                'message' => 'Invalid weekly slot ID',
                'has_appointments' => false,
                'appointments' => [],
                'total_appointments' => 0
            ];
        }
        
        // Get the weekly slot details
        $stmt = $pdo->prepare("
            SELECT doctor_id, day_of_week, start_time, end_time
            FROM doctor_weekly_slots
            WHERE id = ?
        ");
        $stmt->execute([$weeklySlotId]);
        $weeklySlot = $stmt->fetch();
        
        if (!$weeklySlot) {
            return [
                'success' => false,
                'message' => 'Weekly slot not found',
                'has_appointments' => false,
                'appointments' => [],
                'total_appointments' => 0
            ];
        }
        
        // Map day of week ENUM to day name
        $dayMapping = [
            'MONDAY' => 'Monday',
            'TUESDAY' => 'Tuesday',
            'WEDNESDAY' => 'Wednesday',
            'THURSDAY' => 'Thursday',
            'FRIDAY' => 'Friday',
            'SATURDAY' => 'Saturday',
            'SUNDAY' => 'Sunday'
        ];
        $dayName = isset($weeklySlot['day_of_week']) && isset($dayMapping[$weeklySlot['day_of_week']]) 
            ? $dayMapping[$weeklySlot['day_of_week']] 
            : null;
        
        if (!$dayName) {
            return [
                'success' => false,
                'message' => 'Invalid day of week: ' . ($weeklySlot['day_of_week'] ?? 'unknown'),
                'has_appointments' => false,
                'appointments' => [],
                'total_appointments' => 0
            ];
        }
        
        // Check for appointments in upcoming slots (slot_date >= CURDATE())
        // IMPORTANT: Only check for BOOKED appointments
        // COMPLETED, CANCELLED, and NO_SHOW appointments do NOT block deletion
        // Match: doctor_id, start_time, end_time, day_of_week matches slot_date
        // Fix collation mismatch by using COLLATE for DAYNAME() comparison
        $checkStmt = $pdo->prepare("
            SELECT 
                ds.slot_date,
                COUNT(a.id) as appointment_count
            FROM doctor_slots ds
            LEFT JOIN appointments a ON ds.id = a.slot_id 
                AND a.appointment_status = 'BOOKED'  -- Only count BOOKED appointments
            WHERE ds.doctor_id = ?
                AND ds.start_time = ?
                AND ds.end_time = ?
                AND ds.slot_date >= CURDATE()
                AND DAYNAME(ds.slot_date) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
            GROUP BY ds.slot_date
            HAVING appointment_count > 0  -- Only return dates with BOOKED appointments
        ");
        $checkStmt->execute([
            $weeklySlot['doctor_id'],
            $weeklySlot['start_time'],
            $weeklySlot['end_time'],
            $dayName
        ]);
        $appointments = $checkStmt->fetchAll();
        
        if (!empty($appointments)) {
            $appointmentDetails = [];
            foreach ($appointments as $apt) {
                $appointmentDetails[] = [
                    'date' => $apt['slot_date'] ?? '',
                    'count' => (int)($apt['appointment_count'] ?? 0)
                ];
            }
            
            $totalAppointments = 0;
            foreach ($appointments as $apt) {
                $totalAppointments += (int)($apt['appointment_count'] ?? 0);
            }
            
            return [
                'success' => true,
                'has_appointments' => true,
                'appointments' => $appointmentDetails,
                'total_appointments' => $totalAppointments
            ];
        }
        
        return [
            'success' => true,
            'has_appointments' => false,
            'appointments' => [],
            'total_appointments' => 0
        ];
        
    } catch (PDOException $e) {
        error_log("PDO Error checking appointments for weekly slot: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        return [
            'success' => false,
            'message' => 'Database error while checking appointments: ' . $e->getMessage(),
            'has_appointments' => false,
            'appointments' => [],
            'total_appointments' => 0
        ];
    } catch (Exception $e) {
        error_log("Error checking appointments for weekly slot: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        return [
            'success' => false,
            'message' => 'Error checking appointments: ' . $e->getMessage(),
            'has_appointments' => false,
            'appointments' => [],
            'total_appointments' => 0
        ];
    }
}

// DELETE - Delete weekly slot
if ($method === 'DELETE' && $action === 'delete_weekly_slot') {
    // Support both request body and GET parameter for slot ID
    $input = file_get_contents('php://input');
    $data = !empty($input) ? json_decode($input, true) : [];
    $id = $data['id'] ?? $_GET['id'] ?? 0;
    $id = (int)$id;
    
    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Slot ID required']);
        exit;
    }
    
    try {
        $pdo->beginTransaction();
        
        // Step 1: Check if upcoming slots have appointments
        $appointmentCheck = checkUpcomingSlotsForAppointments($pdo, $id);
        
        if (!$appointmentCheck['success']) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            http_response_code(500);
            $errorMessage = isset($appointmentCheck['message']) ? $appointmentCheck['message'] : 'Error checking appointments';
            error_log('Error checking appointments for slot deletion: ' . $errorMessage);
            echo json_encode([
                'success' => false,
                'message' => $errorMessage
            ]);
            exit;
        }
        
        // Step 2: If BOOKED appointments exist, abort deletion
        // Note: Only BOOKED appointments block deletion. COMPLETED, CANCELLED, and NO_SHOW do not block.
        if (isset($appointmentCheck['has_appointments']) && $appointmentCheck['has_appointments']) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            $appointmentDates = [];
            if (isset($appointmentCheck['appointments']) && is_array($appointmentCheck['appointments'])) {
                $appointmentDates = array_column($appointmentCheck['appointments'], 'date');
            }
            $firstDate = !empty($appointmentDates) ? $appointmentDates[0] : 'upcoming dates';
            $totalBooked = $appointmentCheck['total_appointments'] ?? 0;
            
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => "Cannot delete this slot. There are $totalBooked booked appointment(s) for $firstDate.",
                'appointment_details' => $appointmentCheck['appointments'] ?? [],
                'total_appointments' => $totalBooked
            ]);
            exit;
        }
        
        // Step 3: Get weekly slot details for matching
        $getSlotStmt = $pdo->prepare("
            SELECT doctor_id, day_of_week, start_time, end_time
            FROM doctor_weekly_slots
            WHERE id = ?
        ");
        $getSlotStmt->execute([$id]);
        $weeklySlot = $getSlotStmt->fetch();
        
        if (!$weeklySlot) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Weekly slot not found']);
            exit;
        }
        
        // Map day of week ENUM to day name
        $dayMapping = [
            'MONDAY' => 'Monday',
            'TUESDAY' => 'Tuesday',
            'WEDNESDAY' => 'Wednesday',
            'THURSDAY' => 'Thursday',
            'FRIDAY' => 'Friday',
            'SATURDAY' => 'Saturday',
            'SUNDAY' => 'Sunday'
        ];
        $dayName = $dayMapping[$weeklySlot['day_of_week']] ?? null;
        
        if (!$dayName) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Invalid day of week']);
            exit;
        }
        
        // Step 4: Delete all matching upcoming slots from doctor_slots (slot_date >= CURDATE())
        // IMPORTANT: First delete non-BOOKED appointments to avoid foreign key constraint errors
        // Then delete the slots themselves
        // Match: doctor_id, start_time, end_time, day_of_week matches slot_date
        
        // First, get the slot IDs that will be deleted
        $getSlotIdsStmt = $pdo->prepare("
            SELECT id
            FROM doctor_slots
            WHERE doctor_id = ?
                AND start_time = ?
                AND end_time = ?
                AND slot_date >= CURDATE()
                AND DAYNAME(slot_date) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
        ");
        $getSlotIdsStmt->execute([
            $weeklySlot['doctor_id'],
            $weeklySlot['start_time'],
            $weeklySlot['end_time'],
            $dayName
        ]);
        $slotIds = $getSlotIdsStmt->fetchAll(PDO::FETCH_COLUMN);
        $slotsToDelete = count($slotIds);
        
        // Log before deletion for debugging
        error_log("Deleting weekly slot #{$id}: doctor_id={$weeklySlot['doctor_id']}, day={$dayName}, time={$weeklySlot['start_time']}-{$weeklySlot['end_time']}, slots_found={$slotsToDelete}");
        
        // Note: We keep all appointments (COMPLETED/CANCELLED/NO_SHOW) intact - do NOT delete them
        // Only BOOKED appointments block deletion (already checked above)
        // To delete slots while keeping non-BOOKED appointments, we temporarily disable foreign key checks
        // The appointments will remain with orphaned slot_id references, which is acceptable
        
        // Temporarily disable foreign key checks to allow slot deletion
        // while preserving non-BOOKED appointments (they'll have orphaned slot_id references)
        $pdo->exec("SET FOREIGN_KEY_CHECKS = 0");
        
        try {
            // Delete the matching upcoming slots from doctor_slots
            // Non-BOOKED appointments will remain with orphaned slot_id references
            $deleteSlotsStmt = $pdo->prepare("
                DELETE FROM doctor_slots
                WHERE doctor_id = ?
                    AND start_time = ?
                    AND end_time = ?
                    AND slot_date >= CURDATE()
                    AND DAYNAME(slot_date) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
            ");
            $deleteSlotsStmt->execute([
                $weeklySlot['doctor_id'],
                $weeklySlot['start_time'],
                $weeklySlot['end_time'],
                $dayName
            ]);
            $deletedSlotsCount = $deleteSlotsStmt->rowCount();
        } finally {
            // Always re-enable foreign key checks regardless of success or failure
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1");
        }
        
        // Log after deletion with details
        error_log("Deleted weekly slot #{$id}: deleted_count={$deletedSlotsCount}, expected_count={$slotsToDelete}, doctor_id={$weeklySlot['doctor_id']}, start_time={$weeklySlot['start_time']}, end_time={$weeklySlot['end_time']}, day={$dayName}");
        
        // Verify deletion worked
        if ($slotsToDelete > 0 && $deletedSlotsCount === 0) {
            error_log("ERROR: Expected to delete {$slotsToDelete} slots but deleted 0. Possible causes: transaction rollback, time format mismatch, or day name mismatch.");
            
            // Try to get a sample of matching slots to debug
            $debugStmt = $pdo->prepare("
                SELECT id, slot_date, start_time, end_time, DAYNAME(slot_date) as day_name
                FROM doctor_slots
                WHERE doctor_id = ?
                    AND slot_date >= CURDATE()
                LIMIT 5
            ");
            $debugStmt->execute([$weeklySlot['doctor_id']]);
            $sampleSlots = $debugStmt->fetchAll();
            error_log("Sample slots for doctor {$weeklySlot['doctor_id']}: " . json_encode($sampleSlots));
        }
        
        // Step 5: Delete the weekly slot from doctor_weekly_slots
        $deleteWeeklyStmt = $pdo->prepare("DELETE FROM doctor_weekly_slots WHERE id = ?");
        $deleteWeeklyStmt->execute([$id]);
        
        if ($deleteWeeklyStmt->rowCount() === 0) {
            // Slot was already deleted or doesn't exist
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Weekly slot not found or already deleted']);
            exit;
        }
        
        // Commit transaction
        $pdo->commit();
        
        // Log audit (using a fresh connection since we're after commit)
        try {
            logAudit($pdo, 'WEEKLY_SLOT_DELETED', $id, 'doctor_weekly_slots', 
                     "Weekly slot deleted. Removed $deletedSlotsCount upcoming slots from doctor_slots. Non-BOOKED appointments were preserved.");
        } catch (Exception $e) {
            // Log audit failure but don't fail the deletion
            error_log('Failed to log audit for slot deletion: ' . $e->getMessage());
        }
        
        $responseMessage = 'Weekly slot deleted successfully';
        if ($slotsToDelete > 0 && $deletedSlotsCount === 0) {
            $responseMessage .= '. Warning: Expected to delete upcoming slots but none were deleted.';
        }
        
        echo json_encode([
            'success' => true,
            'message' => $responseMessage,
            'upcoming_slots_deleted' => $deletedSlotsCount,
            'upcoming_slots_found' => $slotsToDelete
        ]);
    } catch (PDOException $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        $errorMsg = 'PDO Error deleting weekly slot: ' . $e->getMessage() . ' (Code: ' . $e->getCode() . ')';
        $errorMsg .= ' SQL State: ' . $e->getCode();
        error_log($errorMsg);
        error_log('Stack trace: ' . $e->getTraceAsString());
        
        // Check if it's a foreign key constraint error
        $errorCode = $e->getCode();
        $errorMessage = $e->getMessage();
        $userMessage = 'Failed to delete slot: Database error occurred';
        
        if (strpos($errorMessage, 'foreign key') !== false || strpos($errorMessage, '1451') !== false || $errorCode == 1451) {
            $userMessage = 'Cannot delete slot: There are appointments linked to these slots. Please cancel or complete the appointments first.';
        } elseif (strpos($errorMessage, 'constraint') !== false) {
            $userMessage = 'Cannot delete slot: Database constraint violation. Please check if there are related records.';
        }
        
        echo json_encode([
            'success' => false,
            'message' => $userMessage,
            'error_code' => $errorCode,
            'error_detail' => $errorMessage
        ]);
    } catch (Exception $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        $errorMsg = 'Error deleting weekly slot: ' . $e->getMessage();
        error_log($errorMsg);
        error_log('Stack trace: ' . $e->getTraceAsString());
        echo json_encode([
            'success' => false,
            'message' => 'Failed to delete slot: ' . $e->getMessage()
        ]);
    }
    exit;
}

// Method not allowed
http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
?>