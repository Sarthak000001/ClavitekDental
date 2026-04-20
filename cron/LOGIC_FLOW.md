# Logic Flow Explanation

## Overview
The `cron_generate_slots.php` script generates date-specific slots (`doctor_slots`) from weekly recurring templates (`doctor_weekly_slots`) without modifying or deleting existing records.

## Step-by-Step Flow

### Step 1: Detect Existing Data
```
1. Query: SELECT MAX(slot_date) FROM doctor_slots
2. Result: max_date (NULL or a date)
```

**Decision Tree:**
```
IF max_date IS NULL:
    → First run
    → Start from: First day of current month
ELSE:
    → Subsequent run
    → Start from: Next day after max_date
```

### Step 2: Determine Generation Range
```
First Run:
    start_date = first day of current month
    end_date = last day of current month

Subsequent Runs:
    start_date = next day after max_date
    end_date = last day of next calendar month from start_date
```

**Example:**
- **First run** (Jan 15): Start = Jan 1, End = Jan 31
- **Second run** (Jan 24, max_date = Jan 31): Start = Feb 1, End = Feb 29
- **Third run** (Feb 24, max_date = Feb 29): Start = Mar 1, End = Mar 31

### Step 3: Fetch Weekly Slot Templates
```
1. Query active doctors (is_active = 1)
2. Query their active weekly slots (is_active = 1)
3. Join to get: doctor_id, day_of_week, start_time, end_time, max_capacity, is_active
4. Store in memory as templates
```

**Result:** Array of weekly slot configurations:
```php
[
    ['doctor_id' => 1, 'day_of_week' => 'MONDAY', 'start_time' => '09:00:00', ...],
    ['doctor_id' => 1, 'day_of_week' => 'MONDAY', 'start_time' => '14:00:00', ...],
    ['doctor_id' => 1, 'day_of_week' => 'WEDNESDAY', 'start_time' => '09:00:00', ...],
    ...
]
```

### Step 4: Generate Date-Specific Slots
```
FOR each date in date_range (start_date to end_date):
    Get day_of_week (e.g., "Monday", "Tuesday")
    Convert to ENUM value (e.g., "MONDAY", "TUESDAY")
    
    FOR each weekly_slot in weekly_slots:
        IF weekly_slot.day_of_week matches current date's day_of_week:
            Create slot record:
                - doctor_id = weekly_slot.doctor_id
                - slot_date = current_date
                - start_time = weekly_slot.start_time
                - end_time = weekly_slot.end_time
                - max_capacity = weekly_slot.max_capacity
                - is_active = weekly_slot.is_active
            Add to slots_to_insert array
```

**Day Matching Logic:**
```
Date: 2024-02-05 → Day Name: "Monday" → ENUM: "MONDAY"
Match against: doctor_weekly_slots.day_of_week = "MONDAY"
Result: Generate slots for all MONDAY weekly configurations
```

**Example Generation:**
```
Date: 2024-02-05 (Monday)
Weekly Slots:
  - Doctor 1, MONDAY, 09:00-12:00 → Generate slot: (1, 2024-02-05, 09:00, 12:00)
  - Doctor 1, MONDAY, 14:00-17:00 → Generate slot: (1, 2024-02-05, 14:00, 17:00)
  - Doctor 2, MONDAY, 09:00-13:00 → Generate slot: (2, 2024-02-05, 09:00, 13:00)
  - Doctor 3, TUESDAY, 10:00-13:00 → Skip (day doesn't match)
```

### Step 5: Insert Slots (Idempotent)
```
BEGIN TRANSACTION

FOR each slot in slots_to_insert:
    Execute: INSERT IGNORE INTO doctor_slots (...) VALUES (...)
    IF row inserted (rowCount > 0):
        inserted_count++
    ELSE:
        skipped_count++ (duplicate)

COMMIT TRANSACTION
```

**INSERT IGNORE Behavior:**
- Inserts new slots
- Silently skips duplicates (unique constraint violation)
- Safe to re-run

**Unique Constraint:**
```
UNIQUE (doctor_id, slot_date, start_time, end_time)
```

### Step 6: Log Results
```
1. Log to console (with timestamps)
2. Log to file: cron_generate_slots.log
3. Insert audit record: system_audit_logs
```

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     START CRON JOB                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │  Query MAX(slot_date)        │
        └──────────────┬───────────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
        max_date              max_date
        IS NULL              IS NOT NULL
            │                     │
            ▼                     ▼
    ┌──────────────┐      ┌──────────────┐
    │ FIRST RUN    │      │ SUBSEQUENT   │
    │ Start: 1st   │      │ Start: Next  │
    │ End: Last    │      │ End: Next    │
    │ of month     │      │ month end    │
    └──────┬───────┘      └──────┬───────┘
           │                     │
           └──────────┬──────────┘
                      │
                      ▼
        ┌──────────────────────────────┐
        │ Fetch Active Weekly Slots    │
        │ (Active doctors + slots)     │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ FOR each date in range:      │
        │   FOR each weekly slot:      │
        │     IF day matches:          │
        │       Create date slot       │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ BEGIN TRANSACTION            │
        │ INSERT IGNORE slots          │
        │ (Skip duplicates)            │
        │ COMMIT                       │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │ Log Results                  │
        │ - Console                    │
        │ - File                       │
        │ - Audit table                │
        └──────────────┬───────────────┘
                       │
                       ▼
                   FINISH
```

## Data Flow

### Input Data
```
doctor_weekly_slots:
┌──────────┬────────────┬──────────────┬───────────┬──────────┐
│doctor_id │day_of_week │start_time    │end_time   │max_cap   │
├──────────┼────────────┼──────────────┼───────────┼──────────┤
│1         │MONDAY      │09:00:00      │12:00:00   │10        │
│1         │MONDAY      │14:00:00      │17:00:00   │10        │
│1         │WEDNESDAY   │09:00:00      │12:00:00   │10        │
└──────────┴────────────┴──────────────┴───────────┴──────────┘
```

### Processing
```
Date Loop: 2024-02-05 (Monday)
  → Matches: Doctor 1, MONDAY slots
  → Generates: 2 slots for 2024-02-05

Date Loop: 2024-02-06 (Tuesday)
  → Matches: None (no Tuesday slots for Doctor 1)
  → Generates: 0 slots for 2024-02-06
```

### Output Data
```
doctor_slots:
┌──────────┬────────────┬───────────┬───────────┬──────────┐
│doctor_id │slot_date   │start_time │end_time   │max_cap   │
├──────────┼────────────┼───────────┼───────────┼──────────┤
│1         │2024-02-05  │09:00:00   │12:00:00   │10        │
│1         │2024-02-05  │14:00:00   │17:00:00   │10        │
│1         │2024-02-07  │09:00:00   │12:00:00   │10        │
└──────────┴────────────┴───────────┴───────────┴──────────┘
```

## Key Design Decisions

### 1. Why INSERT IGNORE?
- Idempotent: Safe to re-run
- Handles duplicates gracefully
- No errors on unique constraint violations

### 2. Why Day-of-Week Matching?
- Matches PHP `date('l')` (e.g., "Monday") to ENUM ("MONDAY")
- Only generates slots on days defined in weekly config
- Respects doctor's weekly schedule

### 3. Why Transaction?
- All-or-nothing: If error occurs, rollback all inserts
- Data consistency: No partial generation
- Atomic operation

### 4. Why Separate Start Date Logic?
- First run: Generate current month (special case)
- Subsequent runs: Generate next month (standard case)
- Handles empty table gracefully

## Edge Cases Handled

### 1. Empty doctor_slots Table
- Detected via `MAX(slot_date)` returning NULL
- Handled by starting from first day of current month

### 2. No Active Weekly Slots
- Query returns empty result
- Script logs warning and exits gracefully
- Returns success=false

### 3. Duplicate Slots
- Handled by `INSERT IGNORE`
- Counted in `slots_skipped`
- No error thrown

### 4. Date Range Crossing Months
- Handled by PHP DateTime `modify()` methods
- Correctly calculates "last day of next month"
- Includes all days in range

### 5. Leap Years
- PHP DateTime handles leap years automatically
- February 29 correctly calculated when applicable

## Performance Considerations

### Efficient Queries
- Single query for max date
- Single query for weekly slots
- Prepared statement for inserts (reusable)

### Memory Usage
- Builds array in memory before insert
- Batches all inserts in one transaction
- Cleans up after completion

### Execution Time
- Linear with number of days × number of weekly slots
- Example: 29 days × 12 weekly slots = ~348 inserts
- Typical execution: < 1 second
