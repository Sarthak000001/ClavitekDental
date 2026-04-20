<?php
require_once 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

// Login
if ($method === 'POST' && !isset($_GET['action'])) {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';
    
    // Validate input
    if (empty($username) || empty($password)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Username and password are required'
        ]);
        exit;
    }
    
    // Database lookup for authentication
    try {
        $pdo = getDB();
        
        // Find user by username
        $stmt = $pdo->prepare("
            SELECT id, username, password, full_name, email, role, is_active 
            FROM users 
            WHERE username = ? AND is_active = TRUE
        ");
        $stmt->execute([$username]);
        $user = $stmt->fetch();
        
        // Verify password if user exists (plain text comparison)
        if ($user && $password === $user['password']) {
            // Update last login timestamp
            $updateStmt = $pdo->prepare("
                UPDATE users 
                SET last_login_at = NOW() 
                WHERE id = ?
            ");
            $updateStmt->execute([$user['id']]);
            
            // Set session variables
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['username'] = $user['username'];
            $_SESSION['role'] = $user['role'];
            $_SESSION['last_activity'] = time();
            
            // Log successful login
            logAudit($pdo, 'LOGIN', $user['id'], 'users', "User {$username} logged in successfully");
            
            echo json_encode([
                'success' => true,
                'message' => 'Login successful',
                'user' => [
                    'id' => $user['id'],
                    'username' => $user['username'],
                    'full_name' => $user['full_name'],
                    'role' => $user['role']
                ]
            ]);
        } else {
            // Log failed login attempt
            if ($pdo) {
                logAudit($pdo, 'LOGIN_FAILED', null, 'users', "Failed login attempt for username: {$username}");
            }
            
            http_response_code(401);
            echo json_encode([
                'success' => false,
                'message' => 'Invalid username or password'
            ]);
        }
    } catch (PDOException $e) {
        error_log("Authentication error: " . $e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Authentication service temporarily unavailable'
        ]);
    }
}

// Logout
if ($method === 'POST' && isset($_GET['action']) && $_GET['action'] === 'logout') {
    session_destroy();
    echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
}

// Check session
if ($method === 'GET' && isset($_GET['action']) && $_GET['action'] === 'check') {
    if (isset($_SESSION['user_id'])) {
        try {
            $pdo = getDB();
            $stmt = $pdo->prepare("
                SELECT id, username, full_name, email, role 
                FROM users 
                WHERE id = ? AND is_active = TRUE
            ");
            $stmt->execute([$_SESSION['user_id']]);
            $user = $stmt->fetch();
            
            if ($user) {
                echo json_encode([
                    'success' => true,
                    'authenticated' => true,
                    'user' => [
                        'id' => $user['id'],
                        'username' => $user['username'],
                        'full_name' => $user['full_name'],
                        'role' => $user['role']
                    ]
                ]);
            } else {
                // User was deleted or deactivated
                session_destroy();
                echo json_encode(['success' => true, 'authenticated' => false]);
            }
        } catch (PDOException $e) {
            error_log("Session check error: " . $e->getMessage());
            echo json_encode(['success' => true, 'authenticated' => false]);
        }
    } else {
        echo json_encode(['success' => true, 'authenticated' => false]);
    }
}
?>