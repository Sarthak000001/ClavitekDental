<?php
require_once 'config.php';
checkAuth();

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

/**
 * PATCH: Update a specific session (e.g., reschedule date)
 */
if ($method === 'PATCH') {
    $payload = json_decode(file_get_contents('php://input'), true);
    
    $sessionId = isset($payload['id']) ? (int)$payload['id'] : 0;
    $newDate = isset($payload['expected_date']) ? trim($payload['expected_date']) : '';

    if (!$sessionId || !$newDate) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing session ID or date']);
        exit;
    }

    try {
        $stmt = $pdo->prepare("UPDATE followup_sessions SET expected_date = ? WHERE id = ?");
        $stmt->execute([$newDate, $sessionId]);

        echo json_encode([
            'success' => true,
            'message' => 'Session rescheduled successfully'
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Reschedule failed: ' . $e->getMessage()]);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}
?>
