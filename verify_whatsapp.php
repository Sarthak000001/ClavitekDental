<?php
$pdo = new PDO('mysql:host=localhost;dbname=ClavitekDemo', 'root', '');
$stmt = $pdo->query("SELECT id, patient_name, whatsapp_number FROM patients");
$patients = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "Total Patients: " . count($patients) . "\n";
echo "---------------------------------\n";

$invalidCount = 0;
foreach ($patients as $p) {
    $num = $p['whatsapp_number'];
    $isValid = (preg_match('/^91\d{10}$/', $num));
    if (!$isValid) {
        echo "INVALID: ID={$p['id']}, Name={$p['patient_name']}, Phone={$num}\n";
        $invalidCount++;
    }
}

if ($invalidCount === 0) {
    echo "All phone numbers are correctly normalized to '91xxxxxxxxxx' format.\n";
} else {
    echo "Total Invalid: $invalidCount\n";
}
?>
