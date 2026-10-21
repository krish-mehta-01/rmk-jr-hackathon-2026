-- ============================================
-- RMK JR. HACKATHON 2026 DATABASE SCHEMA
-- ============================================

CREATE DATABASE IF NOT EXISTS rmk_hackathon;
USE rmk_hackathon;

-- Teams table (populated from Excel upload)
CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_uuid VARCHAR(36) NULL,
  team_name VARCHAR(200) NOT NULL,
  leader_name VARCHAR(200) NOT NULL,
  mobile_no VARCHAR(15) UNIQUE NOT NULL,
  email VARCHAR(200),
  college_name VARCHAR(300),
  project_title VARCHAR(300),
  category VARCHAR(100),
  members TEXT,
  mentor_name VARCHAR(200) NULL,
  mentor_contact VARCHAR(50) NULL,
  mentor_email VARCHAR(200) NULL,
  is_present BOOLEAN DEFAULT FALSE,
  check_in_time DATETIME NULL,
  qr_verification_token VARCHAR(64) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_mobile (mobile_no),
  INDEX idx_present (is_present)
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance log table (audit trail)
CREATE TABLE IF NOT EXISTS attendance_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  team_id_fk INT NULL,
  team_name VARCHAR(200),
  leader_name VARCHAR(200),
  check_in_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  qr_code_value VARCHAR(500),
  qr_verification_token VARCHAR(64) NULL,
  ip_address VARCHAR(50),
  INDEX idx_check_in (check_in_time)
);
