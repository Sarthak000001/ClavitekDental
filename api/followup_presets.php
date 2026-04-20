<?php
require_once 'config.php';
checkAuth();

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

/**
 * GET: Fetch presets for a doctor
 */
if ($method === 'GET') {
    $doctorId = $_GET['doctor_id'] ?? '';
    
    if (!$doctorId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing doctor_id']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT id, preset_name, interval_type, total_sessions 
            FROM followup_presets 
            WHERE doctor_id = ? 
            ORDER BY preset_name ASC
        ");
        $stmt->execute([$doctorId]);
        $presets = $stmt->fetchAll();

        echo json_encode([
            'success' => true,
            'data' => $presets
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Query failed: ' . $e->getMessage()]);
    }
}

/**
 * POST: Create a new preset
 */
else if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input'), true);
    
    $doctorId = isset($payload['doctor_id']) ? (int)$payload['doctor_id'] : 0;
    $name = trim($payload['preset_name'] ?? '');
    $interval = trim($payload['interval_type'] ?? '');
    $sessions = isset($payload['total_sessions']) ? (int)$payload['total_sessions'] : 0;

    if (!$doctorId || !$name || !$interval || !$sessions) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO followup_presets (doctor_id, preset_name, interval_type, total_sessions) 
            VALUES (?, ?, ?, ?)
        ");
        $stmt->execute([$doctorId, $name, $interval, $sessions]);
        
        echo json_encode([
            'success' => true,
            'message' => 'Preset saved successfully',
            'id' => $pdo->lastInsertId()
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Save failed: ' . $e->getMessage()]);
    }
}

/**
 * DELETE: Remove a preset
 */
else if ($method === 'DELETE') {
    $id = $_GET['id'] ?? 0;

    if (!$id) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing preset id']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("DELETE FROM followup_presets WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode([
            'success' => true,
            'message' => 'Preset deleted successfully'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Delete failed: ' . $e->getMessage()]);
    }
}

/**
 * PUT: Update an existing preset
 */
else if ($method === 'PUT') {
    $payload = json_decode(file_get_contents('php://input'), true);
    
    $id = isset($payload['id']) ? (int)$payload['id'] : 0;
    $name = trim($payload['preset_name'] ?? '');
    $interval = trim($payload['interval_type'] ?? '');
    $sessions = isset($payload['total_sessions']) ? (int)$payload['total_sessions'] : 0;

    if (!$id || !$name || !$interval || !$sessions) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing required fields']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("
            UPDATE followup_presets 
            SET preset_name = ?, interval_type = ?, total_sessions = ? 
            WHERE id = ?
        ");
        $stmt->execute([$name, $interval, $sessions, $id]);

        echo json_encode([
            'success' => true,
            'message' => 'Preset updated successfully'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Update failed: ' . $e->getMessage()]);
    }
}
?>
