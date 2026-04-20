-- Complete schema with sample data

CREATE TABLE doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_name VARCHAR(100) NOT NULL,
    specialization VARCHAR(100),
    practice_area VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    whatsapp_number VARCHAR(20) NOT NULL UNIQUE,
    patient_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weekly recurring schedule slots (Monday-Sunday)
CREATE TABLE doctor_weekly_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    day_of_week ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY') NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_capacity INT DEFAULT 10,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE (doctor_id, day_of_week, start_time, end_time),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    CHECK (start_time < end_time)
);

-- Date-specific slots (for overrides or specific date slots, can be generated from weekly slots)
CREATE TABLE doctor_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    slot_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_capacity INT DEFAULT 4,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (doctor_id, slot_date, start_time, end_time),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    CHECK (start_time < end_time)
);

CREATE TABLE appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    slot_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    appointment_status ENUM('BOOKED', 'CANCELLED', 'NO_SHOW', 'COMPLETED') DEFAULT 'BOOKED',
    booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (slot_id) REFERENCES doctor_slots(id),
    CHECK (start_time < end_time)
);

CREATE TABLE conversation_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    whatsapp_number VARCHAR(20) NOT NULL UNIQUE,
    current_state VARCHAR(50) NOT NULL,
    selected_doctor_id INT NULL,
    selected_date DATE NULL,
    selected_slot_hour TIME NULL,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (selected_doctor_id) REFERENCES doctors(id)
);

CREATE TABLE conversation_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    whatsapp_number VARCHAR(20) NOT NULL,
    message_direction ENUM('INBOUND', 'OUTBOUND') NOT NULL,
    message_text TEXT,
    related_state VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50),
    reference_id INT,
    reference_table VARCHAR(50),
    event_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

-- Sample data
INSERT INTO doctors (doctor_name, specialization, practice_area, phone, email, is_active) VALUES
('Dr. Sharma', 'General Physician', 'General Practice', '+91 98765 43210', 'dr.sharma@clinic.com', TRUE),
('Dr. Patel', 'Pediatrician', 'Pediatrics', '+91 98765 43211', 'dr.patel@clinic.com', TRUE),
('Dr. Kumar', 'Cardiologist', 'Cardiology', '+91 98765 43212', 'dr.kumar@clinic.com', TRUE),
('Dr. Singh', 'Dermatologist', 'Dermatology', '+91 98765 43213', 'dr.singh@clinic.com', FALSE);

INSERT INTO patients (whatsapp_number, patient_name) VALUES
('+919876543210', 'Raj Kumar'),
('+919876543211', 'Priya Sharma');

-- Sample weekly recurring slots
-- Dr. Sharma (General Physician) - Monday, Wednesday slots
INSERT INTO doctor_weekly_slots (doctor_id, day_of_week, start_time, end_time, max_capacity, is_active) VALUES
(1, 'MONDAY', '09:00:00', '12:00:00', 10, TRUE),
(1, 'MONDAY', '14:00:00', '17:00:00', 10, TRUE),
(1, 'WEDNESDAY', '09:00:00', '12:00:00', 10, TRUE),
(1, 'WEDNESDAY', '14:00:00', '17:00:00', 10, TRUE);

-- Dr. Patel (Pediatrician) - Monday-Friday morning slots
INSERT INTO doctor_weekly_slots (doctor_id, day_of_week, start_time, end_time, max_capacity, is_active) VALUES
(2, 'MONDAY', '09:00:00', '13:00:00', 8, TRUE),
(2, 'TUESDAY', '09:00:00', '13:00:00', 8, TRUE),
(2, 'WEDNESDAY', '09:00:00', '13:00:00', 8, TRUE),
(2, 'THURSDAY', '09:00:00', '13:00:00', 8, TRUE),
(2, 'FRIDAY', '09:00:00', '13:00:00', 8, TRUE);

-- Dr. Kumar (Cardiologist) - Tuesday, Thursday slots
INSERT INTO doctor_weekly_slots (doctor_id, day_of_week, start_time, end_time, max_capacity, is_active) VALUES
(3, 'TUESDAY', '10:00:00', '13:00:00', 6, TRUE),
(3, 'TUESDAY', '15:00:00', '18:00:00', 6, TRUE),
(3, 'THURSDAY', '10:00:00', '13:00:00', 6, TRUE),
(3, 'THURSDAY', '15:00:00', '18:00:00', 6, TRUE);

-- Create slots for past, today, and next 7 days (generated from weekly slots)
-- This is a simplified example - in production, use the slot generation logic
INSERT INTO doctor_slots (doctor_id, slot_date, start_time, end_time, max_capacity, is_active)
SELECT 
    d.id,
    DATE_ADD(CURDATE(), INTERVAL day_offset DAY),
    TIME(CONCAT(hour, ':00:00')),
    TIME(CONCAT(hour + 1, ':00:00')),
    4,
    TRUE
FROM doctors d
CROSS JOIN (SELECT -1 AS day_offset UNION SELECT 0 UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) days
CROSS JOIN (SELECT 9 AS hour UNION SELECT 10 UNION SELECT 11 UNION SELECT 14 UNION SELECT 15 UNION SELECT 16 UNION SELECT 17) hours
WHERE d.is_active = TRUE;

-- Add more test patients
INSERT INTO patients (whatsapp_number, patient_name) VALUES
('+919876543212', 'Amit Verma'),
('+919876543213', 'Sneha Reddy'),
('+919876543214', 'Vikram Mehta'),
('+919876543215', 'Anjali Desai'),
('+919876543216', 'Rohan Kapoor')
ON DUPLICATE KEY UPDATE patient_name = VALUES(patient_name);

-- Test appointments - Today
INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, appointment_status)
SELECT 
    (SELECT id FROM patients WHERE whatsapp_number = '+919876543210' LIMIT 1),
    1,
    s.id,
    CURDATE(),
    s.start_time,
    s.end_time,
    'BOOKED'
FROM doctor_slots s
WHERE s.doctor_id = 1 AND s.slot_date = CURDATE() AND s.start_time = '09:00:00'
LIMIT 1;

INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, appointment_status)
SELECT 
    (SELECT id FROM patients WHERE whatsapp_number = '+919876543211' LIMIT 1),
    1,
    s.id,
    CURDATE(),
    s.start_time,
    s.end_time,
    'BOOKED'
FROM doctor_slots s
WHERE s.doctor_id = 1 AND s.slot_date = CURDATE() AND s.start_time = '10:00:00'
LIMIT 1;

INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, appointment_status)
SELECT 
    (SELECT id FROM patients WHERE whatsapp_number = '+919876543212' LIMIT 1),
    2,
    s.id,
    CURDATE(),
    s.start_time,
    s.end_time,
    'COMPLETED'
FROM doctor_slots s
WHERE s.doctor_id = 2 AND s.slot_date = CURDATE() AND s.start_time = '11:00:00'
LIMIT 1;

INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, appointment_status)
SELECT 
    (SELECT id FROM patients WHERE whatsapp_number = '+919876543213' LIMIT 1),
    2,
    s.id,
    CURDATE(),
    s.start_time,
    s.end_time,
    'BOOKED'
FROM doctor_slots s
WHERE s.doctor_id = 2 AND s.slot_date = CURDATE() AND s.start_time = '14:00:00'
LIMIT 1;

INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, appointment_status)
SELECT 
    (SELECT id FROM patients WHERE whatsapp_number = '+919876543214' LIMIT 1),
    3,
    s.id,
    CURDATE(),
    s.start_time,
    s.end_time,
    'BOOKED'
FROM doctor_slots s
WHERE s.doctor_id = 3 AND s.slot_date = CURDATE() AND s.start_time = '15:00:00'
LIMIT 1;

-- Test appointments - Tomorrow
INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, appointment_status)
SELECT 
    (SELECT id FROM patients WHERE whatsapp_number = '+919876543210' LIMIT 1),
    1,
    s.id,
    DATE_ADD(CURDATE(), INTERVAL 1 DAY),
    s.start_time,
    s.end_time,
    'BOOKED'
FROM doctor_slots s
WHERE s.doctor_id = 1 AND s.slot_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND s.start_time = '09:00:00'
LIMIT 1;

INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, appointment_status)
SELECT 
    (SELECT id FROM patients WHERE whatsapp_number = '+919876543215' LIMIT 1),
    1,
    s.id,
    DATE_ADD(CURDATE(), INTERVAL 1 DAY),
    s.start_time,
    s.end_time,
    'BOOKED'
FROM doctor_slots s
WHERE s.doctor_id = 1 AND s.slot_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND s.start_time = '10:00:00'
LIMIT 1;

INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, appointment_status, cancelled_at)
SELECT 
    (SELECT id FROM patients WHERE whatsapp_number = '+919876543216' LIMIT 1),
    3,
    s.id,
    DATE_ADD(CURDATE(), INTERVAL 1 DAY),
    s.start_time,
    s.end_time,
    'CANCELLED',
    NOW()
FROM doctor_slots s
WHERE s.doctor_id = 3 AND s.slot_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND s.start_time = '14:00:00'
LIMIT 1;

-- Test appointments - Past (yesterday)
INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, appointment_status, booked_at)
SELECT 
    (SELECT id FROM patients WHERE whatsapp_number = '+919876543210' LIMIT 1),
    1,
    s.id,
    DATE_SUB(CURDATE(), INTERVAL 1 DAY),
    s.start_time,
    s.end_time,
    'COMPLETED',
    DATE_SUB(NOW(), INTERVAL 25 HOUR)
FROM doctor_slots s
WHERE s.doctor_id = 1 AND s.slot_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND s.start_time = '10:00:00'
LIMIT 1;

INSERT INTO appointments (patient_id, doctor_id, slot_id, appointment_date, start_time, end_time, appointment_status, booked_at, cancelled_at)
SELECT 
    (SELECT id FROM patients WHERE whatsapp_number = '+919876543211' LIMIT 1),
    2,
    s.id,
    DATE_SUB(CURDATE(), INTERVAL 1 DAY),
    s.start_time,
    s.end_time,
    'CANCELLED',
    DATE_SUB(NOW(), INTERVAL 26 HOUR),
    DATE_SUB(NOW(), INTERVAL 2 HOUR)
FROM doctor_slots s
WHERE s.doctor_id = 2 AND s.slot_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND s.start_time = '14:00:00'
LIMIT 1;

-- Sample users (password for 'receptionist' and 'admin' is 'demo123')
-- In production, these should be changed immediately
INSERT INTO users (username, password, full_name, email, role, is_active) VALUES
('receptionist', 'demo123', 'Receptionist User', 'receptionist@clinic.com', 'receptionist', TRUE),
('admin', 'demo123', 'Admin User', 'admin@clinic.com', 'admin', TRUE);