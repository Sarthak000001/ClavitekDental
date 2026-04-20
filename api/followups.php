<?php
require_once 'config.php';
checkAuth();

error_reporting(E_ALL);
ini_set('display_errors', 1);

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

/**
 * ------------------------------------------------
 * GET : Fetch all follow-up plans with their sessions
 * ------------------------------------------------
 */
if ($method === 'GET') {
    try {
        $statusStr = $_GET['status'] ?? 'ALL'; // ALL, IN_PROGRESS, COMPLETED
        $search = isset($_GET['search']) ? trim($_GET['search']) : '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 8;
        $action = $_GET['action'] ?? '';

        if ($action === 'get_plan_names') {
            $stmt = $pdo->query("SELECT name FROM followup_plan_names ORDER BY name ASC");
            $names = $stmt->fetchAll(PDO::FETCH_COLUMN);
            echo json_encode(['success' => true, 'data' => $names]);
            exit;
        }

        if ($page < 1) $page = 1;
        $offset = ($page - 1) * $limit;

        // 1. Get Global Counts for Tiles
        $countSql = "
            SELECT 
                COUNT(*) as `all`,
                SUM(CASE WHEN (SELECT COUNT(*) FROM followup_sessions fs WHERE fs.plan_id = fp.id AND fs.status = 'COMPLETED') = fp.total_sessions THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN (SELECT COUNT(*) FROM followup_sessions fs WHERE fs.plan_id = fp.id AND fs.status = 'COMPLETED') < fp.total_sessions THEN 1 ELSE 0 END) as in_progress
            FROM followup_plans fp
        ";
        $counts = $pdo->query($countSql)->fetch(PDO::FETCH_ASSOC);

        // 2. Build the main query with filtering and pagination
        $whereClause = [];
        $params = [];

        if ($statusStr === 'COMPLETED') {
            $whereClause[] = "t.completed_sessions = t.total_sessions";
        } elseif ($statusStr === 'IN_PROGRESS') {
            $whereClause[] = "t.completed_sessions < t.total_sessions";
        }

        if (!empty($search)) {
            $whereClause[] = "(t.patient_name LIKE ? OR t.doctor_name LIKE ? OR t.plan_name LIKE ?)";
            $params[] = "%$search%";
            $params[] = "%$search%";
            $params[] = "%$search%";
        }

        $whereStr = count($whereClause) > 0 ? "WHERE " . implode(" AND ", $whereClause) : "";

        // Subquery to calculate completed_sessions first, so we can filter easily
        $baseSql = "
            SELECT 
                fp.id, fp.patient_id, fp.doctor_id, fp.original_appointment_id, 
                fp.total_sessions, fp.interval_type, fp.created_at,
                fpn.name as plan_name,
                p.patient_name, p.whatsapp_number,
                d.doctor_name,
                (SELECT COUNT(*) FROM followup_sessions fs WHERE fs.plan_id = fp.id AND fs.status = 'COMPLETED') as completed_sessions
            FROM followup_plans fp
            JOIN patients p ON p.id = fp.patient_id
            JOIN doctors d ON d.id = fp.doctor_id
            LEFT JOIN followup_plan_names fpn ON fpn.id = fp.plan_name_id
        ";

        // Get total filtered count for pagination
        $filteredCountSql = "SELECT COUNT(*) FROM ($baseSql) as t $whereStr";
        $stmtCount = $pdo->prepare($filteredCountSql);
        $stmtCount->execute($params);
        $totalItems = $stmtCount->fetchColumn();
        $totalPages = ceil($totalItems / $limit);

        // Get the specific page
        $finalSql = "
            SELECT t.* FROM ($baseSql) as t 
            $whereStr
            ORDER BY t.created_at DESC
            LIMIT $limit OFFSET $offset
        ";
        $stmt = $pdo->prepare($finalSql);
        $stmt->execute($params);
        $plans = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Fetch sessions for the result plans
        if (count($plans) > 0) {
            $planIds = array_column($plans, 'id');
            $inQuery = implode(',', array_fill(0, count($planIds), '?'));
            
            $sessionStmt = $pdo->prepare("
                SELECT id, plan_id, session_number, expected_date, appointment_id, status 
                FROM followup_sessions 
                WHERE plan_id IN ($inQuery)
                ORDER BY plan_id, session_number ASC
            ");
            $sessionStmt->execute($planIds);
            $allSessions = $sessionStmt->fetchAll(PDO::FETCH_ASSOC);

            // Group sessions by plan_id
            $sessionsByPlan = [];
            foreach ($allSessions as $session) {
                $sessionsByPlan[$session['plan_id']][] = $session;
            }

            foreach ($plans as &$plan) {
                $planSessions = $sessionsByPlan[$plan['id']] ?? [];
                $plan['sessions'] = $planSessions;
                $plan['progress_percentage'] = $plan['total_sessions'] > 0 
                    ? round(($plan['completed_sessions'] / $plan['total_sessions']) * 100) 
                    : 0;
            }
            unset($plan);
        }

        echo json_encode([
            'success' => true,
            'data' => $plans,
            'counts' => [
                'all' => (int)($counts['all'] ?? 0),
                'in_progress' => (int)($counts['in_progress'] ?? 0),
                'completed' => (int)($counts['completed'] ?? 0)
            ],
            'pagination' => [
                'total_items' => (int)$totalItems,
                'total_pages' => (int)$totalPages,
                'current_page' => $page,
                'limit' => $limit
            ]
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
 * POST : Create a new follow-up plan
 * ------------------------------------------------
 */
if ($method === 'POST') {
    $payload = json_decode(file_get_contents('php://input'), true);

    $patientId = isset($payload['patient_id']) ? (int)$payload['patient_id'] : 0;
    $doctorId = isset($payload['doctor_id']) ? (int)$payload['doctor_id'] : 0;
    $appointmentId = isset($payload['original_appointment_id']) ? (int)$payload['original_appointment_id'] : 0;
    $totalSessions = isset($payload['total_sessions']) ? (int)$payload['total_sessions'] : 0;
    $intervalType = trim($payload['interval_type'] ?? '');
    $sessions = isset($payload['sessions']) ? $payload['sessions'] : []; // Array of dates
    $planName = trim($payload['plan_name'] ?? 'Follow-up Plan');
    $consultationNotes = trim($payload['consultation_notes'] ?? '');
    if (!$patientId || !$doctorId || !$appointmentId || !$totalSessions || !$intervalType || empty($sessions)) {
        error_log("Follow-up Plan Error: Missing fields. ".json_encode([
            'patient_id' => $patientId,
            'doctor_id' => $doctorId,
            'appointment_id' => $appointmentId,
            'total_sessions' => $totalSessions,
            'interval_type' => $intervalType,
            'sessions_count' => count($sessions)
        ]));
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Missing required fields or sessions data'
        ]);
        exit;
    }

    try {
        $pdo->beginTransaction();

        // 0. Resolve plan_name to plan_name_id
        $planIdQuery = $pdo->prepare("SELECT id FROM followup_plan_names WHERE name = ?");
        $planIdQuery->execute([$planName]);
        $planNameId = $planIdQuery->fetchColumn();

        if (!$planNameId) {
            $insertNameStmt = $pdo->prepare("INSERT INTO followup_plan_names (name) VALUES (?)");
            $insertNameStmt->execute([$planName]);
            $planNameId = $pdo->lastInsertId();
        }

        // 1. Create the plan
        $planStmt = $pdo->prepare("
            INSERT INTO followup_plans (patient_id, doctor_id, original_appointment_id, total_sessions, interval_type, plan_name_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $planStmt->execute([$patientId, $doctorId, $appointmentId, $totalSessions, $intervalType, $planNameId]);
        $planId = $pdo->lastInsertId();

        // 2. Insert all sessions
        $sessionStmt = $pdo->prepare("
            INSERT INTO followup_sessions (plan_id, session_number, expected_date, status)
            VALUES (?, ?, ?, 'PENDING')
        ");
        
        foreach ($sessions as $index => $dateStr) {
            $sessionNum = $index + 1;
            $sessionStmt->execute([$planId, $sessionNum, $dateStr]);
        }

        // 3. Mark the original appointment as COMPLETED and save notes
        $updateAptStmt = $pdo->prepare("
            UPDATE appointments 
            SET appointment_status = 'COMPLETED', notes = ? 
            WHERE id = ?
        ");
        $updateAptStmt->execute([$consultationNotes, $appointmentId]);

        $pdo->commit();

        echo json_encode([
            'success' => true,
            'message' => 'Follow-up plan created successfully',
            'plan_id' => $planId
        ]);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ]);
    }
    exit;
}

http_response_code(405);
echo json_encode([
    'success' => false,
    'message' => 'Method not allowed'
]);
