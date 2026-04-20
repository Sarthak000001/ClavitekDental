# SQL Queries Used in Cron Job

This document contains all SQL queries used in the `cron_generate_slots.php` script.

## 1. Find Maximum Slot Date

**Purpose:** Determine the last date for which slots already exist.

```sql
SELECT MAX(slot_date) as max_date 
FROM doctor_slots;
```

**Returns:**
- `max_date`: The maximum date in `doctor_slots`, or `NULL` if table is empty

**Usage:** Determines whether this is the first run and where to start generating new slots.

---

## 2. Fetch Active Weekly Slot Templates

**Purpose:** Get all active weekly slot configurations for active doctors.

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

**Returns:** All active weekly slot configurations that will be used as templates for date-specific slot generation.

**Filters:**
- Only active doctors (`d.is_active = 1`)
- Only active weekly slots (`w.is_active = 1`)

**Example Result:**
```
weekly_slot_id | doctor_id | day_of_week | start_time | end_time | max_capacity | is_active | doctor_name
---------------|-----------|-------------|------------|----------|--------------|-----------|------------
1              | 1         | MONDAY      | 09:00:00   | 12:00:00 | 10           | 1         | Dr. Sharma
2              | 1         | MONDAY      | 14:00:00   | 17:00:00 | 10           | 1         | Dr. Sharma
3              | 1         | WEDNESDAY   | 09:00:00   | 12:00:00 | 10           | 1         | Dr. Sharma
...
```

---

## 3. Insert Slots (Idempotent)

**Purpose:** Insert date-specific slots into `doctor_slots` table, skipping duplicates.

```sql
INSERT IGNORE INTO doctor_slots 
(doctor_id, slot_date, start_time, end_time, max_capacity, is_active)
VALUES (?, ?, ?, ?, ?, ?);
```

**Parameters:**
1. `doctor_id` (INT) - From `doctor_weekly_slots.doctor_id`
2. `slot_date` (DATE) - Generated date in loop
3. `start_time` (TIME) - From `doctor_weekly_slots.start_time`
4. `end_time` (TIME) - From `doctor_weekly_slots.end_time`
5. `max_capacity` (INT) - From `doctor_weekly_slots.max_capacity`
6. `is_active` (BOOLEAN) - From `doctor_weekly_slots.is_active`

**Behavior:**
- `INSERT IGNORE` skips rows that violate unique constraint
- Unique constraint: `UNIQUE (doctor_id, slot_date, start_time, end_time)`
- Safe to re-run (idempotent)

**Example:**
```sql
INSERT IGNORE INTO doctor_slots 
(doctor_id, slot_date, start_time, end_time, max_capacity, is_active)
VALUES 
(1, '2024-02-01', '09:00:00', '12:00:00', 10, 1),
(1, '2024-02-01', '14:00:00', '17:00:00', 10, 1),
(1, '2024-02-05', '09:00:00', '12:00:00', 10, 1),
...
```

---

## 4. Log Audit Event

**Purpose:** Record cron job execution in audit log table.

```sql
INSERT INTO system_audit_logs 
(event_type, reference_id, reference_table, event_description) 
VALUES (?, ?, ?, ?);
```

**Parameters:**
1. `event_type` (VARCHAR) - Always `'SLOT_GENERATION'`
2. `reference_id` (INT) - `NULL` (no specific record reference)
3. `reference_table` (VARCHAR) - `'doctor_slots'`
4. `event_description` (TEXT) - Detailed description with counts and date range

**Example Description:**
```
"Cron job generated 348 slots from 2024-02-01 to 2024-02-29. Skipped 0 duplicates."
```

**Example Result in `system_audit_logs`:**
```
id | event_type       | reference_id | reference_table | event_description                                    | created_at
---|------------------|--------------|-----------------|-----------------------------------------------------|-------------------
5  | SLOT_GENERATION  | NULL         | doctor_slots    | Cron job generated 348 slots from...                | 2024-01-24 02:00:10
```

---

## Verification Queries

### Check Generated Slots

**Count slots by date range:**
```sql
SELECT 
    slot_date,
    COUNT(*) as slot_count,
    COUNT(DISTINCT doctor_id) as doctor_count
FROM doctor_slots
WHERE slot_date BETWEEN '2024-02-01' AND '2024-02-29'
GROUP BY slot_date
ORDER BY slot_date;
```

**View slots for a specific doctor:**
```sql
SELECT 
    slot_date,
    start_time,
    end_time,
    max_capacity,
    is_active
FROM doctor_slots
WHERE doctor_id = 1
    AND slot_date BETWEEN '2024-02-01' AND '2024-02-29'
ORDER BY slot_date, start_time;
```

**Check date range coverage:**
```sql
SELECT 
    MIN(slot_date) as earliest_slot,
    MAX(slot_date) as latest_slot,
    COUNT(*) as total_slots,
    COUNT(DISTINCT doctor_id) as total_doctors,
    COUNT(DISTINCT slot_date) as total_days
FROM doctor_slots;
```

### Check Audit Logs

**View recent cron executions:**
```sql
SELECT 
    id,
    event_type,
    event_description,
    created_at
FROM system_audit_logs
WHERE event_type = 'SLOT_GENERATION'
ORDER BY created_at DESC
LIMIT 10;
```

### Verify Weekly Slots

**Check available weekly slot templates:**
```sql
SELECT 
    d.doctor_name,
    w.day_of_week,
    w.start_time,
    w.end_time,
    w.max_capacity,
    w.is_active
FROM doctor_weekly_slots w
JOIN doctors d ON w.doctor_id = d.id
WHERE d.is_active = 1
ORDER BY d.id, w.day_of_week, w.start_time;
```

---

## Index Recommendations

For optimal performance, ensure these indexes exist:

```sql
-- Index for MAX(slot_date) query
CREATE INDEX idx_slot_date ON doctor_slots(slot_date);

-- Index for checking active doctors and weekly slots (if not already exists)
CREATE INDEX idx_doctor_active ON doctors(is_active);
CREATE INDEX idx_weekly_slot_active ON doctor_weekly_slots(is_active);

-- Composite index for weekly slot lookup (if not already exists)
CREATE INDEX idx_weekly_doctor_active ON doctor_weekly_slots(doctor_id, is_active);

-- Unique constraint should already exist, but verify:
SHOW INDEX FROM doctor_slots WHERE Key_name = 'doctor_id';
```

---

## Troubleshooting Queries

### Check for Missing Slots

**Find dates in range without slots:**
```sql
-- Generate date series and left join with slots
SELECT 
    date_series.date,
    COUNT(ds.id) as slot_count
FROM (
    SELECT DATE('2024-02-01') + INTERVAL (a.a + (10 * b.a) + (100 * c.a)) DAY AS date
    FROM (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS a
    CROSS JOIN (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS b
    CROSS JOIN (SELECT 0 AS a UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9) AS c
) AS date_series
LEFT JOIN doctor_slots ds ON date_series.date = ds.slot_date
WHERE date_series.date BETWEEN '2024-02-01' AND '2024-02-29'
GROUP BY date_series.date
HAVING slot_count = 0;
```

### Check Duplicate Slots

**Find potential duplicates (should be 0 with INSERT IGNORE):**
```sql
SELECT 
    doctor_id,
    slot_date,
    start_time,
    end_time,
    COUNT(*) as duplicate_count
FROM doctor_slots
GROUP BY doctor_id, slot_date, start_time, end_time
HAVING duplicate_count > 1;
```

### Verify Weekly Slot Matching

**Check if weekly slots are being matched correctly:**
```sql
-- Compare weekly slots with generated slots for a specific date
SELECT 
    w.day_of_week,
    w.start_time,
    w.end_time,
    COUNT(ds.id) as generated_slots
FROM doctor_weekly_slots w
LEFT JOIN doctor_slots ds ON 
    w.doctor_id = ds.doctor_id 
    AND ds.slot_date = '2024-02-05'  -- Example: Monday
    AND w.start_time = ds.start_time
    AND w.end_time = ds.end_time
WHERE w.doctor_id = 1
    AND w.day_of_week = 'MONDAY'
GROUP BY w.day_of_week, w.start_time, w.end_time;
```
