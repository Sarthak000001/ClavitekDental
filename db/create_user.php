<?php
/**
 * Helper script to create users with plain text passwords
 * 
 * Usage:
 *   php create_user.php <username> <password> [full_name] [email] [role]
 * 
 * Example:
 *   php create_user.php receptionist demo123 "Receptionist User" receptionist@clinic.com receptionist
 *   php create_user.php admin admin123 "Admin User" admin@clinic.com admin
 */

require_once __DIR__ . '/../api/config.php';

if ($argc < 3) {
    echo "Usage: php create_user.php <username> <password> [full_name] [email] [role]\n";
    echo "Example: php create_user.php receptionist demo123 'Receptionist User' receptionist@clinic.com receptionist\n";
    exit(1);
}

$username = $argv[1];
$password = $argv[2];
$fullName = $argv[3] ?? null;
$email = $argv[4] ?? null;
$role = $argv[5] ?? 'receptionist';

// Validate role
$validRoles = ['admin', 'receptionist', 'doctor'];
if (!in_array($role, $validRoles)) {
    echo "Error: Role must be one of: " . implode(', ', $validRoles) . "\n";
    exit(1);
}

try {
    $pdo = getDB();
    
    // Check if user already exists
    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        echo "Error: Username '{$username}' already exists\n";
        exit(1);
    }
    
    // Store password as plain text (no hashing)
    // Insert user
    $stmt = $pdo->prepare("
        INSERT INTO users (username, password, full_name, email, role, is_active)
        VALUES (?, ?, ?, ?, ?, TRUE)
    ");
    $stmt->execute([$username, $password, $fullName, $email, $role]);
    
    $userId = $pdo->lastInsertId();
    
    echo "Success: User created with ID {$userId}\n";
    echo "Username: {$username}\n";
    echo "Role: {$role}\n";
    if ($fullName) {
        echo "Full Name: {$fullName}\n";
    }
    if ($email) {
        echo "Email: {$email}\n";
    }
    
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>
