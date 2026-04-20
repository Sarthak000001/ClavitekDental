<?php
try {
    $pdo = new PDO('mysql:host=localhost;dbname=ClavitekDemo', 'root', '');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Check if column already exists
    $stmt = $pdo->query("SHOW COLUMNS FROM followup_plans LIKE 'plan_name'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE followup_plans ADD COLUMN plan_name VARCHAR(255) DEFAULT 'Follow-up Plan' AFTER original_appointment_id");
        echo "Migration successful: Column 'plan_name' added to 'followup_plans'.\n";
    } else {
        echo "Column 'plan_name' already exists in 'followup_plans'.\n";
    }
} catch(Exception $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
?>
