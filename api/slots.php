<?php
require_once 'config.php';
checkAuth();

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// GET - List slots with booking counts
if ($method === 'GET') {
    $date          = $_GET['date']           ?? date('Y-m-d');
    $doctorId      = $_GET['doctor_id']      ?? null;
    $availableOnly = !empty($_GET['available_only']);

    $sql = "
        SELECT 
            s.id,
            s.doctor_id,
            s.slot_date,
            s.start_time,
            s.end_time,
            s.max_capacity,
            s.is_active,
            d.doctor_name,
            COUNT(a.id) as booked_count
        FROM doctor_slots s
        JOIN doctors d ON s.doctor_id = d.id
        LEFT JOIN appointments a ON s.id = a.slot_id 
            AND a.appointment_status = 'BOOKED'
        WHERE s.slot_date = ?
    ";
    
    $params = [$date];

    if ($doctorId) {
        $sql .= " AND s.doctor_id = ?";
        $params[] = $doctorId;
    }

    // Only active slots when listing for booking
    if ($availableOnly) {
        $sql .= " AND s.is_active = 1";
    }

    $sql .= " GROUP BY s.id";

    // Exclude full slots when listing for booking
    if ($availableOnly) {
        $sql .= " HAVING booked_count < s.max_capacity";
    }

    $sql .= " ORDER BY s.start_time";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $slots = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'data' => $slots
    ]);
}

// PUT - Update slot
if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? 0;
    $maxCapacity = $data['max_capacity'] ?? null;
    $isActive = $data['is_active'] ?? null;
    
    // Build dynamic update query
    $updates = [];
    $params = [];
    
    if ($maxCapacity !== null) {
        $updates[] = "max_capacity = ?";
        $params[] = (int)$maxCapacity;
    }
    
    if ($isActive !== null) {
        $updates[] = "is_active = ?";
        $params[] = $isActive ? 1 : 0;
    }
    
    if (empty($updates)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No updates provided']);
        exit;
    }
    
    $params[] = $id;
    $sql = "UPDATE doctor_slots SET " . implode(', ', $updates) . " WHERE id = ?";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    logAudit($pdo, 'SLOT_UPDATED', $id, 'doctor_slots', 'Slot configuration changed');
    
    echo json_encode([
        'success' => true,
        'message' => 'Slot updated successfully'
    ]);
}
?>