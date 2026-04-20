<?php
$pdo = new PDO('mysql:host=localhost;dbname=ClavitekDemo', 'root', '');
$total = $pdo->query('SELECT COUNT(*) FROM followup_plans')->fetchColumn();
$joined = $pdo->query('SELECT COUNT(*) FROM followup_plans fp JOIN patients p ON p.id = fp.patient_id JOIN doctors d ON d.id = fp.doctor_id')->fetchColumn();
echo "Total Plans: $total\n";
echo "Joined Plans: $joined\n";
$plans = $pdo->query('SELECT id, patient_id, doctor_id FROM followup_plans')->fetchAll(PDO::FETCH_ASSOC);
print_r($plans);
?>
