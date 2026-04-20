-- Add Follow-up Tables

CREATE TABLE IF NOT EXISTS followup_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    original_appointment_id INT NOT NULL,
    total_sessions INT NOT NULL,
    interval_type ENUM('daily', 'weekly', 'monthly', 'custom') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(id),
    FOREIGN KEY (original_appointment_id) REFERENCES appointments(id)
);

CREATE TABLE IF NOT EXISTS followup_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    plan_id INT NOT NULL,
    session_number INT NOT NULL,
    expected_date DATE NOT NULL,
    appointment_id INT NULL,
    status ENUM('PENDING', 'BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES followup_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
);
