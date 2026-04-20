<?php
require_once 'config.php';
checkAuth();

// ================================
// BASIC HARDENING (production-safe)
// ================================
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Get database connection from config.php
$pdo = getDB();

// ================================
// ROUTING
// ================================
$method = $_SERVER['REQUEST_METHOD'];

/**
 * ------------------------------------------------
 * GET : Fetch appointments with filters
 * ------------------------------------------------
 */
if ($method === 'GET') {
    $action = $_GET['action'] ?? '';
    $date = $_GET['date'] ?? '';
    $dateFrom = $_GET['date_from'] ?? '';
    $dateTo = $_GET['date_to'] ?? '';
    $search = $_GET['search'] ?? '';
    $doctorId = $_GET['doctor_id'] ?? '';
    $status = $_GET['status'] ?? '';
    $type = $_GET['type'] ?? '';

    try {
        // Build WHERE clause for dates
        $whereConditions = [];
        $params = [];
        
        // Support both single date and date range
        if (!empty($date)) {
            // Single date (backward compatibility)
            $whereConditions[] = "a.appointment_date = ?";
            $params[] = $date;
        } else if (!empty($dateFrom) && !empty($dateTo)) {
            // Date range
            $whereConditions[] = "a.appointment_date >= ? AND a.appointment_date <= ?";
            $params[] = $dateFrom;
            $params[] = $dateTo;
        } else if (!empty($dateFrom)) {
            // Only from date
            $whereConditions[] = "a.appointment_date >= ?";
            $params[] = $dateFrom;
        } else if (!empty($dateTo)) {
            // Only to date
            $whereConditions[] = "a.appointment_date <= ?";
            $params[] = $dateTo;
        } else {
            // Default to today if no date specified (only for normal fetch, export handles empty dates as all unless filtered)
            // For export, if no date is given, we might want to export all or still default to today. 
            // Stick to UI behavior: UI defaults to today if no filter.
            if ($action !== 'export') {
                 $today = date('Y-m-d');
                 $whereConditions[] = "a.appointment_date = ?";
                 $params[] = $today;
            } else {
                 // For export, if dates are strictly empty, fetch all? 
                 // Or stick to today default if params missing. 
                 // JS sends date params even if default. 
                 // If params missing entirely, fallback to today.
                 if (empty($dateFrom) && empty($dateTo) && empty($date)) {
                     $today = date('Y-m-d');
                     $whereConditions[] = "a.appointment_date = ?";
                     $params[] = $today;
                 }
            }
        }
        
        if (!empty($search)) {
            $normalizedSearch = normalizePhone($search);
            $whereConditions[] = "(p.patient_name LIKE ? OR p.whatsapp_number LIKE ? OR (LENGTH(?) > 2 AND p.whatsapp_number LIKE ?))";
            $searchParam = '%' . $search . '%';
            $normalizedLike = '%' . $normalizedSearch . '%';
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $normalizedSearch;
            $params[] = $normalizedLike;
        }
        
        if (!empty($doctorId)) {
            $whereConditions[] = "a.doctor_id = ?";
            $params[] = (int)$doctorId;
        }
        
        if (!empty($status)) {
            $whereConditions[] = "a.appointment_status = ?";
            $params[] = $status;
        }

        if ($type === 'normal') {
            $whereConditions[] = "NOT EXISTS (SELECT 1 FROM followup_sessions fs WHERE fs.appointment_id = a.id)";
        } else if ($type === 'followup') {
            $whereConditions[] = "EXISTS (SELECT 1 FROM followup_sessions fs WHERE fs.appointment_id = a.id)";
        }
        
        $whereClause = implode(' AND ', $whereConditions);
        
        // Get appointments with slot information
        $stmt = $pdo->prepare("
            SELECT 
                a.id,
                a.patient_id,
                a.doctor_id,
                a.appointment_date,
                a.start_time,
                a.end_time,
                a.appointment_status,
                a.slot_id,
                d.doctor_name,
                p.patient_name,
                p.whatsapp_number,
                (SELECT 1 FROM followup_sessions fs WHERE fs.appointment_id = a.id LIMIT 1) as is_followup
            FROM appointments a
            INNER JOIN doctors d ON d.id = a.doctor_id
            INNER JOIN patients p ON p.id = a.patient_id
            WHERE $whereClause
            ORDER BY a.appointment_date ASC, a.start_time ASC
        ");

        $stmt->execute($params);
        $appointments = $stmt->fetchAll();
        
        // Handle Export Action
        if ($action === 'export') {
            $filename = "appointments_export_" . date('Y-m-d_H-i-s') . ".csv";
            
            header('Content-Type: text/csv');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            
            $output = fopen('php://output', 'w');
            
            // Add BOM for Excel compatibility with UTF-8
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
            
            // CSV Headers
            fputcsv($output, ['Sr. No.', 'Date', 'Start Time', 'End Time', 'Doctor', 'Patient Name', 'WhatsApp Number', 'Status']);
            
            $srNo = 1;
            foreach ($appointments as $apt) {
                fputcsv($output, [
                    $srNo++,
                    $apt['appointment_date'],
                    substr($apt['start_time'], 0, 5), // Format HH:MM
                    substr($apt['end_time'], 0, 5),   // Format HH:MM
                    $apt['doctor_name'],
                    $apt['patient_name'],
                    $apt['whatsapp_number'],
                    $apt['appointment_status']
                ]);
            }
            
            fclose($output);
            exit;
        }

        // Add slot time range aliases for backward compatibility
        foreach ($appointments as &$apt) {
            $apt['slot_start_time'] = $apt['start_time'];
            $apt['slot_end_time'] = $apt['end_time'];
        }
        unset($apt); // Break reference
        
        // Also get doctors list for filter dropdown
        $doctorsStmt = $pdo->query("
            SELECT id, doctor_name 
            FROM doctors 
            WHERE is_active = 1 
            ORDER BY doctor_name
        ");
        $doctors = $doctorsStmt->fetchAll();

        echo json_encode([
            'success' => true,
            'data' => [
                'appointments' => $appointments,
                'doctors' => $doctors
            ]
        ]);
        exit;

    } catch (Exception $e) {
        http_response_code(500);
        if ($action === 'export') {
            die("Error exporting data: " . $e->getMessage());
        }
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
        exit;
    }
}

/**
 * ------------------------------------------------
 * PUT : Update appointment status
 * ------------------------------------------------
 */
if ($method === 'PUT') {

    $payload = json_decode(file_get_contents('php://input'), true);

    if (!$payload || empty($payload['id']) || empty($payload['status'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid payload'
        ]);
        exit;
    }

    $id = (int) $payload['id'];
    $status = strtoupper(trim($payload['status']));
    $notes = isset($payload['notes']) ? trim($payload['notes']) : null;

    $allowed = ['BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];
    if (!in_array($status, $allowed, true)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid status'
        ]);
        exit;
    }

    try {
        // Build update query
        $queryParams = [$status];
        $sql = "UPDATE appointments SET appointment_status = ?";
        
        if ($notes !== null) {
            $sql .= ", notes = ?";
            $queryParams[] = $notes;
        }

        if ($status === 'CANCELLED') {
            $sql .= ", cancelled_at = NOW()";
        } else {
            $sql .= ", cancelled_at = NULL";
        }

        $sql .= " WHERE id = ?";
        $queryParams[] = $id;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($queryParams);

        // ============= SYNC WITH FOLLOW-UP SESSIONS =============
        // If this appointment is linked to a follow-up session, update the session status too
        $syncStmt = $pdo->prepare("
            UPDATE followup_sessions 
            SET status = ? 
            WHERE appointment_id = ?
        ");
        $syncStmt->execute([$status, $id]);
        // ========================================================


        echo json_encode([
            'success' => true,
            'message' => 'Status updated successfully'
        ]);
        exit;

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
        exit;
    }
}

/**
 * ------------------------------------------------
 * POST : Create a new appointment
 * ------------------------------------------------
 */
if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input'), true);

    $patientId       = isset($payload['patient_id'])       ? (int)$payload['patient_id']       : 0;
    $doctorId        = isset($payload['doctor_id'])        ? (int)$payload['doctor_id']        : 0;
    $slotId          = isset($payload['slot_id'])          ? (int)$payload['slot_id']          : 0;
    $appointmentDate = trim($payload['appointment_date']   ?? '');
    $notes           = trim($payload['notes']              ?? '');
    $followupSessionId = isset($payload['followup_session_id']) ? (int)$payload['followup_session_id'] : 0;

    // Basic validation
    if (!$patientId || !$doctorId || !$slotId || !$appointmentDate) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'patient_id, doctor_id, slot_id and appointment_date are required'
        ]);
        exit;
    }

    try {
        // Verify slot exists, is active, and has capacity
        $slotStmt = $pdo->prepare("
            SELECT s.id, s.start_time, s.end_time, s.max_capacity,
                   COUNT(a.id) AS booked_count
            FROM doctor_slots s
            LEFT JOIN appointments a ON s.id = a.slot_id
                AND a.appointment_status = 'BOOKED'
            WHERE s.id = ? AND s.doctor_id = ? AND s.slot_date = ? AND s.is_active = 1
            GROUP BY s.id
        ");
        $slotStmt->execute([$slotId, $doctorId, $appointmentDate]);
        $slot = $slotStmt->fetch();

        if (!$slot) {
            http_response_code(404);
            echo json_encode(['success' => false, 'message' => 'Slot not found or not available']);
            exit;
        }

        if ((int)$slot['booked_count'] >= (int)$slot['max_capacity']) {
            http_response_code(409);
            echo json_encode(['success' => false, 'message' => 'This slot is fully booked']);
            exit;
        }

        // Insert the appointment
        $insertStmt = $pdo->prepare("
            INSERT INTO appointments
                (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, appointment_status, notes)
            VALUES (?, ?, ?, ?, ?, ?, 'BOOKED', ?)
        ");
        $insertStmt->execute([
            $patientId,
            $doctorId,
            $slotId,
            $appointmentDate,
            $slot['start_time'],
            $slot['end_time'],
            $notes
        ]);

        $newId = $pdo->lastInsertId();
        $sessionInfo = null;

        // ============= LINK TO FOLLOW-UP SESSION =============
        if ($followupSessionId > 0) {
            $linkStmt = $pdo->prepare("
                UPDATE followup_sessions 
                SET appointment_id = ?, status = 'BOOKED' 
                WHERE id = ?
            ");
            $linkStmt->execute([$newId, $followupSessionId]);

            // Fetch session progress for WhatsApp
            $sessionStmt = $pdo->prepare("
                SELECT fs.session_number, fp.total_sessions
                FROM followup_sessions fs
                JOIN followup_plans fp ON fp.id = fs.plan_id
                WHERE fs.id = ?
            ");
            $sessionStmt->execute([$followupSessionId]);
            $sessionData = $sessionStmt->fetch();
            if ($sessionData) {
                $sessionInfo = "Session " . $sessionData['session_number'] . " of " . $sessionData['total_sessions'];
            }
        }
        // =====================================================

        // ── Fetch patient WhatsApp number + doctor name for the WA message ──
        $detailsStmt = $pdo->prepare("
            SELECT
                p.patient_name,
                p.whatsapp_number,
                d.doctor_name
            FROM patients p
            JOIN doctors  d ON d.id = ?
            WHERE p.id = ?
            LIMIT 1
        ");
        $detailsStmt->execute([$doctorId, $patientId]);
        $apptDetails = $detailsStmt->fetch();

        // ── Send WhatsApp confirmation (non-blocking — booking already saved) ──
        $waSent  = false;
        $waError = null;
        if ($apptDetails && !empty($apptDetails['whatsapp_number'])) {
            $waResult = sendWhatsAppConfirmation(
                $apptDetails['whatsapp_number'],
                [
                    'patient_name'     => $apptDetails['patient_name'],
                    'appointment_date' => $appointmentDate,
                    'start_time'       => $slot['start_time'],
                    'end_time'         => $slot['end_time'],
                    'doctor_name'      => $apptDetails['doctor_name'],
                    'session_info'     => $sessionInfo,
                ]
            );
            $waSent  = $waResult['sent'];
            $waError = $waResult['error'];
        }

        echo json_encode([
            'success'  => true,
            'message'  => 'Appointment booked successfully',
            'data'     => ['id' => (int)$newId],
            'wa_sent'  => $waSent,
            'wa_error' => $waError
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// ================================
// FALLBACK
// ================================
http_response_code(405);
echo json_encode([
    'success' => false,
    'message' => 'Method not allowed'
]);
