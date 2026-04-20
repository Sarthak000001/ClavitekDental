<?php
$pdo = new PDO('mysql:host=localhost;dbname=ClavitekDemo', 'root', '');
$plans = $pdo->query('SELECT id, patient_id, doctor_id, created_at FROM followup_plans ORDER BY created_at DESC')->fetchAll(PDO::FETCH_ASSOC);
print_r($plans);
?>
