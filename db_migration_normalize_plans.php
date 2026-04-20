<?php
try {
    $pdo = new PDO('mysql:host=localhost;dbname=ClavitekDemo', 'root', '');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $pdo->beginTransaction();

    // 1. Create the new table
    $pdo->exec("CREATE TABLE IF NOT EXISTS followup_plan_names (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
    )");
    echo "Table 'followup_plan_names' created or already exists.\n";

    // 2. Insert unique names from followup_plans into the new table
    $pdo->exec("INSERT IGNORE INTO followup_plan_names (name) 
                SELECT DISTINCT plan_name FROM followup_plans 
                WHERE plan_name IS NOT NULL AND plan_name != ''");
    echo "Unique plan names migrated to the new table.\n";

    // 3. Add plan_name_id column to followup_plans
    // Check if it already exists
    $stmt = $pdo->query("SHOW COLUMNS FROM followup_plans LIKE 'plan_name_id'");
    if ($stmt->rowCount() === 0) {
        $pdo->exec("ALTER TABLE followup_plans ADD COLUMN plan_name_id INT AFTER original_appointment_id");
        echo "Column 'plan_name_id' added to 'followup_plans'.\n";
    }

    // 4. Update followup_plans.plan_name_id based on names
    $pdo->exec("UPDATE followup_plans fp
                JOIN followup_plan_names fpn ON fp.plan_name = fpn.name
                SET fp.plan_name_id = fpn.id");
    echo "IDs updated in 'followup_plans'.\n";

    // 5. Remove the old plan_name column
    $stmt = $pdo->query("SHOW COLUMNS FROM followup_plans LIKE 'plan_name'");
    if ($stmt->rowCount() > 0) {
        $pdo->exec("ALTER TABLE followup_plans DROP COLUMN plan_name");
        echo "Column 'plan_name' dropped from 'followup_plans'.\n";
    }

    $pdo->commit();
    echo "Migration completed successfully!\n";

} catch(Exception $e) {
    if (isset($pdo)) $pdo->rollBack();
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
?>
