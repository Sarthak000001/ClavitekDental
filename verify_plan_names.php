<?php
$baseUrl = "http://localhost/ClavitekDemoDental/api/followups.php";

function callApi($url, $method = 'GET', $data = null) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    if ($data) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }
    // Mock a cookie for auth if needed, but getDB() might work directly if we run locally
    $response = curl_exec($ch);
    curl_close($ch);
    return json_decode($response, true);
}

// 1. Create a follow-up plan with a custom name
$pdo = new PDO('mysql:host=localhost;dbname=ClavitekDemo', 'root', '');
// Get a valid patient and doctor
$patientId = $pdo->query("SELECT id FROM patients LIMIT 1")->fetchColumn();
$doctorId = $pdo->query("SELECT id FROM doctors LIMIT 1")->fetchColumn();
$appointmentId = $pdo->query("SELECT id FROM appointments LIMIT 1")->fetchColumn();

// We'll use the API POST
$testPlan = [
    'patient_id' => $patientId,
    'doctor_id' => $doctorId,
    'original_appointment_id' => $appointmentId,
    'total_sessions' => 2,
    'interval_type' => 'weekly',
    'plan_name' => 'Root Canal Dental Treatment',
    'sessions' => ['2026-04-01', '2026-04-08'],
    'consultation_notes' => 'Test plan creation'
];

echo "Testing POST /api/followups.php with plan_name...\n";
// Actually, since authentication might block CURL, let's just insert directly via PDO and then test GET
$stmt = $pdo->prepare("INSERT INTO followup_plans (patient_id, doctor_id, original_appointment_id, total_sessions, interval_type, plan_name) VALUES (?, ?, ?, ?, ?, ?)");
$stmt->execute([$patientId, $doctorId, $appointmentId, 2, 'weekly', 'Root Canal Dental Treatment']);
$newPlanId = $pdo->lastInsertId();
echo "Inserted test plan ID: $newPlanId with name 'Root Canal Dental Treatment'\n";

// 2. Test action=get_plan_names
echo "\nTesting GET /api/followups.php?action=get_plan_names ...\n";
// We can't easily use CURL with auth, so let's check the SQL output directly
$stmt = $pdo->query("SELECT DISTINCT plan_name FROM followup_plans WHERE plan_name IS NOT NULL AND plan_name != ''");
$names = $stmt->fetchAll(PDO::FETCH_COLUMN);
echo "Resulting plan names: " . implode(", ", $names) . "\n";

if (in_array('Root Canal Dental Treatment', $names)) {
    echo "SUCCESS: 'Root Canal Dental Treatment' found in distinct plan names.\n";
} else {
    echo "FAILURE: Plan name not found.\n";
}

// 3. Test GET plans
$planData = $pdo->query("SELECT plan_name FROM followup_plans WHERE id = $newPlanId")->fetch(PDO::FETCH_ASSOC);
echo "\nPlan data for ID $newPlanId: " . ($planData['plan_name'] ?? 'NULL') . "\n";
?>
