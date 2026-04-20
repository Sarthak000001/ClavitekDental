# Database Authentication Setup

This document describes how to set up and use database-based authentication for production.

## Setup Steps

### 1. Create the Users Table

Run the migration script to create the `users` table:

```bash
mysql -u root -p somani_whatsapp < db/add_users_table.sql
```

Or import it using phpMyAdmin or your MySQL client.

### 2. Default Users

The migration script creates two default users:

- **Username:** `receptionist`
- **Password:** `demo123`
- **Role:** `receptionist`

- **Username:** `admin`
- **Password:** `demo123`
- **Role:** `admin`

⚠️ **IMPORTANT:** Change these default passwords in production!

### 3. Create New Users

Use the helper script to create new users:

```bash
php db/create_user.php <username> <password> [full_name] [email] [role]
```

**Examples:**

```bash
# Create a receptionist user
php db/create_user.php receptionist2 newpassword123 "Receptionist Name" receptionist2@clinic.com receptionist

# Create an admin user
php db/create_user.php admin2 securepass456 "Admin Name" admin2@clinic.com admin

# Create a doctor user
php db/create_user.php doctor1 docpass789 "Dr. Smith" doctor1@clinic.com doctor
```

**Available Roles:**
- `admin` - Full system access
- `receptionist` - Receptionist access (default)
- `doctor` - Doctor access

## Security Features

### Password Storage
- Passwords are stored as plain text in the database
- Password comparison is done directly (no hashing)

### Session Management
- Session-based authentication
- Automatic session timeout (configurable in `config.php`)
- Last activity tracking
- Session validation on each request

### Audit Logging
- All login attempts are logged to `system_audit_logs`
- Failed login attempts are tracked
- Successful logins record user ID and timestamp

### User Management
- Users can be activated/deactivated via `is_active` flag
- Inactive users cannot log in
- Soft delete capability (set `is_active = FALSE`)

## Database Schema

The `users` table structure:

```sql
CREATE TABLE users (
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
```

## API Endpoints

### Login
**POST** `/api/auth.php`

```json
{
  "username": "receptionist",
  "password": "demo123"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "receptionist",
    "full_name": "Receptionist User",
    "role": "receptionist"
  }
}
```

### Logout
**POST** `/api/auth.php?action=logout`

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Check Session
**GET** `/api/auth.php?action=check`

**Success Response:**
```json
{
  "success": true,
  "authenticated": true,
  "user": {
    "id": 1,
    "username": "receptionist",
    "full_name": "Receptionist User",
    "role": "receptionist"
  }
}
```

## Production Checklist

- [ ] Run the migration script to create `users` table
- [ ] Change default passwords for `receptionist` and `admin` users
- [ ] Create production users using the helper script
- [ ] Review and configure `SESSION_TIMEOUT` in `config.php`
- [ ] Enable SSL/TLS for production (HTTPS)
- [ ] Configure secure session settings in PHP
- [ ] Set up password complexity requirements (if needed)
- [ ] Implement account lockout after failed attempts (optional)
- [ ] Set up password reset functionality (optional)
- [ ] Review audit logs regularly

## Updating Passwords

To change a user's password, you can use MySQL directly:

```sql
UPDATE users 
SET password = 'newpassword123'
WHERE username = 'receptionist';
```

Or use the helper script to recreate the user (it will fail if user exists, so you may need to delete first or modify the script).

## Troubleshooting

### User cannot log in
1. Check if user exists: `SELECT * FROM users WHERE username = 'username';`
2. Verify `is_active = TRUE`
3. Verify password matches exactly (case-sensitive)
4. Review audit logs for login attempts

### Session expires quickly
- Check `SESSION_TIMEOUT` in `config.php` (default: 3600 seconds = 1 hour)
- Verify session storage configuration in PHP
- Check server time settings

### Database connection errors
- Verify database credentials in `config.php`
- Check if `users` table exists
- Verify MySQL service is running
