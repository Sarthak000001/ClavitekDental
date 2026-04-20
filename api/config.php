<?php
// Simple environment variable loader for PHP
$envPath = __DIR__ . '/../.env';
if (file_exists($envPath)) {
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);
            // Remove wrapping quotes if present
            if (preg_match('/^"(.*)"$/', $value, $matches) || preg_match("/^'(.*)'$/", $value, $matches)) {
                $value = $matches[1];
            }
            if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
                putenv(sprintf('%s=%s', $name, $value));
                $_ENV[$name] = $value;
                $_SERVER[$name] = $value;
            }
        }
    }
}

// Helper to get environment variables with fallback
function env($key, $default = null) {
    if (isset($_ENV[$key])) return $_ENV[$key];
    if (isset($_SERVER[$key])) return $_SERVER[$key];
    $val = getenv($key);
    return $val !== false ? $val : $default;
}

// Database configuration
define('DB_HOST', env('DB_HOST', 'localhost'));
define('DB_NAME', env('DB_NAME', 'ClavitekDemo'));
define('DB_USER', env('DB_USER', 'root'));
define('DB_PASS', env('DB_PASS', ''));

// ── WhatsApp Meta Cloud API ─────────────────────────────────────────────────
define('WA_ACCESS_TOKEN',    env('WA_ACCESS_TOKEN', ''));
define('WA_PHONE_NUMBER_ID', env('WA_PHONE_NUMBER_ID', ''));
define('WA_API_VERSION',     env('WA_API_VERSION', 'v19.0'));

// Clinic info (shown in the WhatsApp message)
define('CLINIC_NAME',       env('CLINIC_NAME', "Somani's Clinic"));
define('CLINIC_DIRECTIONS', env('CLINIC_DIRECTIONS', 'https://maps.app.goo.gl/jywJGgZbaueAzzwW6'));
define('CLINIC_PHONE',      env('CLINIC_PHONE', '+918810391291'));
// ───────────────────────────────────────────────────────────────────────────



// Security settings
define('SESSION_TIMEOUT', 3600); // 1 hour

// Initialize database connection
function getDB() {
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
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection failed']);
        exit;
    }
}

// Start session
session_start();

// Check authentication
function checkAuth() {
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['last_activity'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Not authenticated']);
        exit;
    }
    
    // Check session timeout
    if (time() - $_SESSION['last_activity'] > SESSION_TIMEOUT) {
        session_destroy();
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Session expired']);
        exit;
    }
    
    $_SESSION['last_activity'] = time();
}

// Log audit event
function logAudit($pdo, $eventType, $referenceId, $referenceTable, $description) {
    $stmt = $pdo->prepare("
        INSERT INTO system_audit_logs 
        (event_type, reference_id, reference_table, event_description) 
        VALUES (?, ?, ?, ?)
    ");
    $stmt->execute([$eventType, $referenceId, $referenceTable, $description]);
}

/**
 * Normalize phone number to '91xxxxxxxxxx' format (no +)
 */
function normalizePhone($phone) {
    if (empty($phone)) return '';
    $digits = preg_replace('/\D/', '', $phone);
    if (strlen($digits) === 10) {
        $digits = '91' . $digits;
    } elseif (substr($digits, 0, 1) === '0' && strlen($digits) === 11) {
        $digits = '91' . substr($digits, 1);
    }
    return $digits;
}

/**
 * Send WhatsApp appointment confirmation via Meta Cloud API
 * Uses the 'book_appointment' approved template.
 *
 * Template body parameters (in order):
 *   1. patient_name
 *   2. doctor_name
 *   3. slot_date      (DD-MM-YYYY)
 *   4. message        ("HH:MM AM – HH:MM PM")
 *   5. phone          (clinic phone number)
 *
 * @param string $toNumber  Patient WhatsApp number (any format)
 * @param array  $details   Keys: patient_name, appointment_date, start_time, end_time, doctor_name
 * @return array            ['sent' => bool, 'error' => string|null]
 */
function sendWhatsAppConfirmation($toNumber, $details) {
    // ── 1. Sanitise → digits only, ensure country code ─────────────────────
    $digits = normalizePhone($toNumber);

    // ── 2. Build template parameters ───────────────────────────────────────
    // Param 4: time-slot string  e.g. "11:00 AM – 12:00 PM"
    $fmt12 = function($t) {
        list($h, $m) = explode(':', substr($t, 0, 5));
        $h = (int)$h; $m = (int)$m;
        $period = $h >= 12 ? 'PM' : 'AM';
        $h12    = $h % 12 ?: 12;
        return sprintf('%d:%02d %s', $h12, $m, $period);
    };
    $timeSlotMsg = $fmt12($details['start_time']) . ' - ' . $fmt12($details['end_time']);

    // Param 3: date DD-MM-YYYY
    $dateObj = DateTime::createFromFormat('Y-m-d', $details['appointment_date']);
    $dateFmt = $dateObj ? $dateObj->format('d-m-Y') : $details['appointment_date'];

    $sessionInfo = $details['session_info'] ?? null;
    $templateName = $sessionInfo ? 'followup_booking' : 'bookappointment';

    // ── 3. Build template payload ───────────────────────────────────────────
    $parameters = [
        ['type' => 'text', 'text' => $details['patient_name']],  // {{1}} patient_name
    ];

    if ($sessionInfo) {
        // Follow-up template parameters:
        // {{1}} patient_name, {{2}} doctor_name, {{3}} session_info, {{4}} date, {{5}} time
        $parameters[] = ['type' => 'text', 'text' => $details['doctor_name']];
        $parameters[] = ['type' => 'text', 'text' => $sessionInfo];
        $parameters[] = ['type' => 'text', 'text' => $dateFmt];
        $parameters[] = ['type' => 'text', 'text' => $timeSlotMsg];
    } else {
        // Standard template parameters:
        // {{1}} patient_name, {{2}} date, {{3}} time, {{4}} doctor_name
        $parameters[] = ['type' => 'text', 'text' => $dateFmt];
        $parameters[] = ['type' => 'text', 'text' => $timeSlotMsg];
        $parameters[] = ['type' => 'text', 'text' => $details['doctor_name']];
    }

    $payload = json_encode([
        'messaging_product' => 'whatsapp',
        'to'                => $digits,
        'type'              => 'template',
        'template'          => [
            'name'       => $templateName,
            'language'   => ['code' => 'en'],
            'components' => [
                [
                    'type'       => 'body',
                    'parameters' => $parameters
                ]
            ]
        ]
    ], JSON_UNESCAPED_UNICODE);

    // ── 4. Send via Meta Cloud API ─────────────────────────────────────────
    $url = 'https://graph.facebook.com/' . WA_API_VERSION . '/' . WA_PHONE_NUMBER_ID . '/messages';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . WA_ACCESS_TOKEN
        ],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
    ]);

    $response  = curl_exec($ch);
    $httpCode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        error_log("WhatsApp cURL error: $curlError");
        return ['sent' => false, 'error' => $curlError];
    }

    $decoded = json_decode($response, true);
    if ($httpCode === 200 && !empty($decoded['messages'])) {
        return ['sent' => true, 'error' => null];
    }

    $errMsg = $decoded['error']['message'] ?? "HTTP $httpCode";
    $errCode = $decoded['error']['code'] ?? null;
    error_log("WhatsApp API error ($errCode): $errMsg | Response: $response");
    return ['sent' => false, 'error' => "[$errCode] $errMsg", 'raw' => $response];
}

// CORS headers (web only — skip when config is loaded from CLI scripts)
if (PHP_SAPI !== 'cli') {
    header('Access-Control-Allow-Origin: *');
    header('Content-Type: application/json');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        exit(0);
    }
}
?>