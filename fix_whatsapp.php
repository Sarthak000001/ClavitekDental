<?php
$pdo = new PDO('mysql:host=localhost;dbname=ClavitekDemo', 'root', '');
// Remove + prefix
$count1 = $pdo->exec("UPDATE patients SET whatsapp_number = REPLACE(whatsapp_number, '+', '') WHERE whatsapp_number LIKE '+%'");
// Add 91 prefix to 10-digit numbers
$count2 = $pdo->exec("UPDATE patients SET whatsapp_number = CONCAT('91', whatsapp_number) WHERE LENGTH(whatsapp_number) = 10");
// Fix 11-digit numbers starting with 0
$count3 = $pdo->exec("UPDATE patients SET whatsapp_number = CONCAT('91', SUBSTRING(whatsapp_number, 2)) WHERE LENGTH(whatsapp_number) = 11 AND whatsapp_number LIKE '0%'");

echo "Cleaned +: $count1 rows\n";
echo "Added 91: $count2 rows\n";
echo "Fixed 0 prefix: $count3 rows\n";
?>
