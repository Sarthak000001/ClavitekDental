<?php
$pdo = new PDO('mysql:host=localhost;dbname=ClavitekDemo', 'root', '');
echo "--- followup_plans ---\n";
$stmt = $pdo->query("DESCRIBE followup_plans");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n--- followup_plan_names ---\n";
$stmt = $pdo->query("DESCRIBE followup_plan_names");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));

echo "\n--- Sample Data (followup_plan_names) ---\n";
$stmt = $pdo->query("SELECT * FROM followup_plan_names");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
