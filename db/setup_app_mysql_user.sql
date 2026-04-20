-- Run once as MySQL root (matches api/config.php: user admin / password demo123):
--   mysql -u root -p < db/setup_app_mysql_user.sql
-- Then import schema:
--   mysql -u admin -pdemo123 ClavitekDemo < db/schema.sql

CREATE DATABASE IF NOT EXISTS ClavitekDemo CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'admin'@'localhost' IDENTIFIED BY 'demo123';
GRANT ALL PRIVILEGES ON ClavitekDemo.* TO 'admin'@'localhost';
FLUSH PRIVILEGES;
