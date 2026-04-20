-- Migration script to add users table for authentication
-- Run this script to add database authentication support

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    email VARCHAR(100),
    role ENUM('admin', 'receptionist', 'doctor') DEFAULT 'receptionist',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Sample users
-- Default password for both users: 'demo123'
-- IMPORTANT: Change these passwords in production!
-- NOTE: Passwords are stored as plain text (not hashed)
INSERT INTO users (username, password, full_name, email, role, is_active) VALUES
('receptionist', 'demo123', 'Receptionist User', 'receptionist@clinic.com', 'receptionist', TRUE),
('admin', 'demo123', 'Admin User', 'admin@clinic.com', 'admin', TRUE)
ON DUPLICATE KEY UPDATE username = username;
