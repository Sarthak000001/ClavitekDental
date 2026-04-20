<?php
require_once 'config.php';
checkAuth();

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ================================
// GET - Search patients
// ================================
if ($method === 'GET') {
    $search = trim($_GET['search'] ?? '');

    if (strlen($search) < 1) {
        echo json_encode(['success' => true, 'data' => []]);
        exit;
    }

    try {
        $normalizedSearch = normalizePhone($search);
        $like = '%' . $search . '%';
        $normalizedLike = '%' . $normalizedSearch . '%';
        
        $stmt = $pdo->prepare("
            SELECT id, patient_name, whatsapp_number
            FROM patients
            WHERE patient_name LIKE ? OR whatsapp_number LIKE ? 
               OR (LENGTH(?) > 2 AND whatsapp_number LIKE ?)
            ORDER BY patient_name ASC
            LIMIT 10
        ");
        $stmt->execute([$like, $like, $normalizedSearch, $normalizedLike]);
        $patients = $stmt->fetchAll();

        echo json_encode(['success' => true, 'data' => $patients]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// ================================
// POST - Create new patient
// ================================
if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input'), true);

    $patientName    = trim($payload['patient_name'] ?? '');
    $whatsappNumber = normalizePhone(trim($payload['whatsapp_number'] ?? ''));

    if (empty($patientName) || empty($whatsappNumber)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Patient name and valid WhatsApp number are required']);
        exit;
    }

    try {
        // Check if patient with this normalized number already exists
        $checkStmt = $pdo->prepare("SELECT id, patient_name, whatsapp_number FROM patients WHERE whatsapp_number = ? LIMIT 1");
        $checkStmt->execute([$whatsappNumber]);
        $existing = $checkStmt->fetch();

        if ($existing) {
            // Return the existing patient instead of an error
            echo json_encode([
                'success' => true,
                'data'    => $existing,
                'existing' => true
            ]);
            exit;
        }

        $stmt = $pdo->prepare("INSERT INTO patients (patient_name, whatsapp_number) VALUES (?, ?)");
        $stmt->execute([$patientName, $whatsappNumber]);
        $newId = $pdo->lastInsertId();

        echo json_encode([
            'success' => true,
            'data'    => [
                'id'               => (int)$newId,
                'patient_name'     => $patientName,
                'whatsapp_number'  => $whatsappNumber
            ],
            'existing' => false
        ]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
    exit;
}

// Fallback
http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
