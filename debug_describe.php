<?php
$pdo = new PDO('mysql:host=localhost;dbname=ClavitekDemo', 'root', '');
$stmt = $pdo->query("DESCRIBE followup_plans");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
?>
