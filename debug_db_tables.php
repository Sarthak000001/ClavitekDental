<?php
$pdo = new PDO('mysql:host=localhost;dbname=ClavitekDemo', 'root', '');
$tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
print_r($tables);
foreach ($tables as $table) {
    if (strpos($table, 'followup') !== false) {
        $count = $pdo->query("SELECT COUNT(*) FROM $table")->fetchColumn();
        echo "Table: $table, Count: $count\n";
    }
}
?>
