# Cron Job Documentation: Doctor Slot Generation

## Overview
The `cron_generate_slots.php` script automatically generates doctor appointment slots for the next 30 days. It runs once every 30 days and extends availability without modifying or deleting existing records.

## File Location
```
cron/cron_generate_slots.php
```

## Execution Frequency
- **Runs**: Once every 30 days
- **Mode**: CLI or HTTP (for testing)

## Authentication

### HTTP Basic Authentication
The cron endpoint is protected with HTTP Basic Authentication when accessed via HTTP (web browser or HTTP request).

**CLI Execution**: No authentication required (recommended for production)

**HTTP Execution**: Requires username and password

### Default Credentials
- **Username**: `admin`
- **Password**: `cron_secure_pass_2024`

⚠️ **IMPORTANT**: Change these credentials before deploying to production!

### Changing Credentials

#### Option 1: Environment Variables (Recommended)
Set environment variables on your server:
```bash
# Linux/Mac
export CRON_AUTH_USERNAME="your_secure_username"
export CRON_AUTH_PASSWORD="your_secure_password"

# Windows (PowerShell)
$env:CRON_AUTH_USERNAME="your_secure_username"
$env:CRON_AUTH_PASSWORD="your_secure_password"
```

#### Option 2: Edit Script Directly
Edit `cron/cron_generate_slots.php` and modify these lines:
```php
define('CRON_AUTH_USERNAME', getenv('CRON_AUTH_USERNAME') ?: 'your_secure_username');
define('CRON_AUTH_PASSWORD', getenv('CRON_AUTH_PASSWORD') ?: 'your_secure_password');
```

## Setup Instructions

### 1. CLI Execution (Recommended for Production)
```bash
# Add to crontab (Linux/Mac)
0 2 * * * cd /path/to/somani-whatsapp-chatbot && /usr/bin/php cron/cron_generate_slots.php

# Or for Windows Task Scheduler
php.exe "C:\xampp\htdocs\somani-whatsapp-chatbot\cron\cron_generate_slots.php"
```

**Note**: CLI execution does NOT require authentication credentials.

### 2. HTTP Execution (For Testing)

#### Using Browser
1. Visit: `http://your-domain/cron/cron_generate_slots.php`
2. Enter username and password when prompted
3. View JSON response with generation results

#### Using cURL
```bash
curl -u admin:cron_secure_pass_2024 \
  http://your-domain/cron/cron_generate_slots.php
```

#### Using Postman/Insomnia
1. Set Authentication type to "Basic Auth"
2. Enter username: `admin`
3. Enter password: `cron_secure_pass_2024`
4. Send GET request to the endpoint

#### Using PHP
```php
$username = 'admin';
$password = 'cron_secure_pass_2024';
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'header' => 'Authorization: Basic ' . base64_encode("$username:$password")
    ]
]);
$result = file_get_contents('http://your-domain/cron/cron_generate_slots.php', false, $context);
echo $result;
```

## Generation Logic Flow

### Step 1: Detect Existing Data
The script queries `doctor_slots` to find the maximum `slot_date`:

```sql
SELECT MAX(slot_date) as max_date FROM doctor_slots;
```

**Behavior:**
- If no records exist (first run): Start from first day of current month
- If records exist: Start from next day after maximum date

### Step 2: Determine Generation Range
Calculate the end date as the last day of the next full calendar month from the start date.

**Examples:**
- Start date: January 15 → End date: Last day of February
- Start date: February 1 → End date: Last day of March
- Start date: First day of current month (first run) → End date: Last day of current month

### Step 3: Fetch Weekly Slot Templates
Query active doctors with their active weekly slot configurations:

```sql
SELECT 
    w.id as weekly_slot_id,
    w.doctor_id,
    w.day_of_week,
    w.start_time,
    w.end_time,
    w.max_capacity,
    w.is_active,
    d.doctor_name
FROM doctor_weekly_slots w
INNER JOIN doctors d ON w.doctor_id = d.id
WHERE d.is_active = 1 
    AND w.is_active = 1
ORDER BY w.doctor_id, w.day_of_week, w.start_time;
```

### Step 4: Generate Date-Specific Slots
For each day in the date range:
1. Determine day of week (Monday, Tuesday, etc.)
2. Match against `doctor_weekly_slots.day_of_week`
3. Create slot records using:
   - `slot_date` = Current date in loop
   - `start_time` = From weekly slot
   - `end_time` = From weekly slot
   - `max_capacity` = From weekly slot
   - `is_active` = From weekly slot

### Step 5: Insert Slots (Idempotent)
Use `INSERT IGNORE` to skip duplicates:

```sql
INSERT IGNORE INTO doctor_slots 
(doctor_id, slot_date, start_time, end_time, max_capacity, is_active)
VALUES (?, ?, ?, ?, ?, ?);
```

This respects the unique constraint: `UNIQUE (doctor_id, slot_date, start_time, end_time)`

## Key SQL Queries

### 1. Find Maximum Slot Date
```sql
SELECT MAX(slot_date) as max_date FROM doctor_slots;
```

### 2. Fetch Active Weekly Slots
```sql
SELECT 
    w.id as weekly_slot_id,
    w.doctor_id,
    w.day_of_week,
    w.start_time,
    w.end_time,
    w.max_capacity,
    w.is_active,
    d.doctor_name
FROM doctor_weekly_slots w
INNER JOIN doctors d ON w.doctor_id = d.id
WHERE d.is_active = 1 
    AND w.is_active = 1
ORDER BY w.doctor_id, w.day_of_week, w.start_time;
```

### 3. Insert Slots (Batch)
```sql
INSERT IGNORE INTO doctor_slots 
(doctor_id, slot_date, start_time, end_time, max_capacity, is_active)
VALUES (?, ?, ?, ?, ?, ?);
```

### 4. Audit Log
```sql
INSERT INTO system_audit_logs 
(event_type, reference_id, reference_table, event_description) 
VALUES ('SLOT_GENERATION', NULL, 'doctor_slots', ?);
```

## Data Integrity Rules

### ✅ What the Script Does:
1. **Only generates from `doctor_weekly_slots`** - No hardcoded slots
2. **Matches day of week** - Slots only on days defined in weekly config
3. **Copies exact attributes** - start_time, end_time, max_capacity, is_active
4. **Only active records** - Filters inactive doctors and weekly slots
5. **Respects unique constraint** - Uses INSERT IGNORE to skip duplicates
6. **Transactional** - All or nothing approach
7. **Idempotent** - Safe to re-run

### ❌ What the Script Never Does:
1. **Never updates** existing slots
2. **Never deletes** existing slots
3. **Never modifies** slot timings
4. **Never splits or merges** slots
5. **Never adjusts capacity** manually
6. **Never generates** slots on days not in weekly config

## Example Execution Scenarios

### Scenario 1: First Run (Empty Table)
**Current Date:** January 15, 2024
- Max date: `NULL`
- Start date: January 1, 2024 (first day of current month)
- End date: January 31, 2024 (last day of current month)
- **Result:** Slots generated for entire January

### Scenario 2: Second Run (24th of Month)
**Current Date:** January 24, 2024
**Max date in DB:** January 31, 2024
- Start date: February 1, 2024 (next day after max)
- End date: February 29, 2024 (last day of next month)
- **Result:** Slots generated for entire February

### Scenario 3: Third Run
**Current Date:** February 24, 2024
**Max date in DB:** February 29, 2024
- Start date: March 1, 2024
- End date: March 31, 2024
- **Result:** Slots generated for entire March

## Logging

### Console Output
All operations are logged to console with timestamps:
```
[2024-01-24 02:00:00] [INFO] === Starting Slot Generation Process ===
[2024-01-24 02:00:01] [INFO] Found existing slots. Maximum date: 2024-01-31
[2024-01-24 02:00:02] [INFO] Generation range: 2024-02-01 to 2024-02-29 (inclusive)
[2024-01-24 02:00:03] [INFO] Found 12 active weekly slot configurations
[2024-01-24 02:00:05] [INFO] Processed 29 days. Prepared 348 slots for insertion
[2024-01-24 02:00:10] [INFO] === Slot Generation Completed Successfully ===
[2024-01-24 02:00:10] [INFO] Slots inserted: 348
[2024-01-24 02:00:10] [INFO] Slots skipped (duplicates): 0
```

### Log File
Logs are also written to: `cron/cron_generate_slots.log`

### Audit Table
Event logged in `system_audit_logs`:
```
event_type: SLOT_GENERATION
reference_table: doctor_slots
event_description: "Cron job generated 348 slots from 2024-02-01 to 2024-02-29. Skipped 0 duplicates."
```

## Error Handling

### Database Connection Error
- Logs error and exits with code 1
- Transaction rolled back if active

### Empty Weekly Slots
- Logs warning
- Returns success=false
- No slots generated

### Duplicate Key Violations
- Handled silently via `INSERT IGNORE`
- Counted in `slots_skipped`

### Other Exceptions
- Full stack trace logged
- Transaction rolled back
- Returns success=false

## Testing

### Manual Test (HTTP)
1. Visit: `http://localhost/somani-whatsapp-chatbot/cron/cron_generate_slots.php`
2. Enter username and password when browser prompts
3. View JSON response with generation results

**Example with cURL:**
```bash
curl -u admin:cron_secure_pass_2024 \
  http://localhost/somani-whatsapp-chatbot/cron/cron_generate_slots.php
```

### CLI Test
```bash
php cron/cron_generate_slots.php
```

**Note**: CLI execution does not require authentication.

### Verification Queries
```sql
-- Check slots generated in last run
SELECT 
    MIN(slot_date) as first_date,
    MAX(slot_date) as last_date,
    COUNT(*) as total_slots
FROM doctor_slots;

-- Check slots for a specific date range
SELECT 
    slot_date,
    doctor_id,
    start_time,
    end_time,
    max_capacity
FROM doctor_slots
WHERE slot_date BETWEEN '2024-02-01' AND '2024-02-29'
ORDER BY slot_date, doctor_id, start_time;

-- Check audit logs
SELECT * FROM system_audit_logs 
WHERE event_type = 'SLOT_GENERATION'
ORDER BY created_at DESC
LIMIT 10;
```

## Performance Considerations

### Efficiency
- Uses prepared statements for batch inserts
- Processes all days in a single loop
- Single transaction for all inserts
- Minimal database queries

### Optimization Tips
1. Run during off-peak hours (e.g., 2 AM)
2. Monitor log file size (rotate if needed)
3. Index on `doctor_slots(slot_date)` for faster MAX query
4. Consider batch size limits for very large datasets

## Troubleshooting

### No slots generated
**Check:**
1. Are there active doctors? `SELECT * FROM doctors WHERE is_active = 1;`
2. Are there active weekly slots? `SELECT * FROM doctor_weekly_slots WHERE is_active = 1;`
3. Check log file for warnings

### Duplicates not skipped
**Verify:**
- Unique constraint exists: `SHOW INDEX FROM doctor_slots;`
- Using INSERT IGNORE (should not throw errors)

### Wrong date range
**Verify:**
- Current date is correct: `SELECT NOW();`
- Maximum slot_date query: `SELECT MAX(slot_date) FROM doctor_slots;`

### Authentication Issues
**If you get 401 Unauthorized:**
1. Check credentials are correct
2. For Apache: Ensure PHP is configured to parse Authorization header
3. For Nginx: May need to pass HTTP_AUTHORIZATION header to PHP-FPM
4. Verify environment variables are set (if using them)
5. Check server logs for authentication errors

**Nginx Configuration Example:**
```nginx
location ~ \.php$ {
    fastcgi_pass unix:/var/run/php/php-fpm.sock;
    fastcgi_param HTTP_AUTHORIZATION $http_authorization;
    # ... other fastcgi params
}
```

## Return Values

### Success Response
```json
{
    "success": true,
    "message": "Slots generated successfully",
    "start_date": "2024-02-01",
    "end_date": "2024-02-29",
    "slots_generated": 348,
    "slots_skipped": 0,
    "days_processed": 29
}
```

### Failure Response
```json
{
    "success": false,
    "message": "Error: Database connection failed",
    "slots_generated": 0
}
```

## Maintenance

### Log Rotation
Consider rotating the log file monthly:
```bash
# Linux/Mac
mv cron_generate_slots.log cron_generate_slots_$(date +%Y%m).log
```

### Monitoring
Monitor:
1. Log file size
2. Audit table entries
3. Slot counts per date range
4. Execution time
