-- Add Follow-up Presets Table

CREATE TABLE IF NOT EXISTS followup_presets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    preset_name VARCHAR(255) NOT NULL,
    interval_type ENUM('daily', 'weekly', 'monthly', 'custom') NOT NULL,
    total_sessions INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);
