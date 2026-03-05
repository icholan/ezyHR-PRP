# Time & Attendance Logic Deep Dive

The Time & Attendance module (Layer 11) is the most table-heavy section (10 tables), designed to handle complex shift patterns, overnight work, and automated OT triggers.

## 1. Core Configuration (Shifts & Schedules)
Shifts are defined at the **Entity** level but applied per **Employment**.

*   **`shifts`**: Defines `start_time`, `end_time`, `break_minutes`, and `grace_minutes` (e.g., 5 mins late allowed before flagging).
*   **`is_overnight`**: Critical flag for shifts like 10 PM – 6 AM. The system auto-splits hours at midnight to ensure correct calendar-day OT calculation.
*   **`work_schedules`**: Defines the "standard" week (e.g., Mon-Fri 44 hours). Used to identify **Rest Days** and **Off Days**.

## 2. Roster Management (`shift_roster`)
For industries with dynamic scheduling (F&B, Healthcare):
*   **`day_type`**: Overrides the default schedule. Can be `normal`, `rest_day`, `off_day`, or `public_holiday`.
*   **Conflict Prevention**: One roster per `employment_id` + `roster_date` (UNIQUE constraint).

## 3. Clocking & Geo-Fencing
The system supports multiple `source` types: `biometric`, `mobile_app`, `web_portal`, `qr_code`.
*   **Location Tracking**: Captures `location_lat` and `location_lng` for mobile clock-ins.
*   **Amendments**: Any manual change to a clock-in/out record is logged in `attendance_amendments` for audit.

## 4. Automated Daily Processing (`daily_attendance`)
Every night, a Celery task processes the previous day's data:
1.  **Hours Calculation**: Subtracts `break_minutes` from total `actual_hours`.
2.  **Lateness/Early Leave**: Calculated based on the assigned `shift` + `grace_minutes`.
3.  **OT Triggers**: 
    *   If `actual_hours` > `scheduled_hours` on a normal day.
    *   All hours worked on a **Rest Day** or **Public Holiday**.
4.  **Status**: Defaults to `pending` until a manager approves it via the `manager` role's assigned departments.

## 5. Summary & Payroll Integration
*   **`monthly_ot_summary`**: Aggregates all approved `daily_attendance` for the month.
*   **Finalization**: Once `is_finalized=true`, the Payroll Engine pulls these totals to compute OT pay (using the 209 divisor).
*   **Compliance Checks**: Automatically flags if total OT hours for the month exceed **72 hours**.

## 6. Key Tables Overview
| Table | Description |
| :--- | :--- |
| **`shifts`** | Template for working hours. |
| **`shift_roster`** | Concrete schedule for a specific day. |
| **`attendance_records`** | Raw clock-in/out data + location. |
| **`daily_attendance`** | Computed results (OT, Late, Absent). |
| **`monthly_ot_summary`** | Payroll-ready monthly totals. |
| **`ot_settings`** | Per-employee eligibility and caps. |
