# Policy & Technical Guide: MOM-Compliant Leave Management

This document outlines the statutory requirements for leave in Singapore (MOM) and the technical logic for implementing these rules within ezyHR.

---

## 1. Statutory Leave Types

### A. Annual Leave (Employment Act, Part IV)
*   **Eligibility**: Minimum 3 months of continuous service.
*   **Standard Entitlement**:
    | Year of Service | Days of Leave |
    | :--- | :--- |
    | 1st | 7 |
    | 2nd | 8 |
    | 3rd | 9 |
    | 4th | 10 |
    | 5th | 11 |
    | 6th | 12 |
    | 7th | 13 |
    | 8th and above | 14 |
*   **Non-Part IV Employees**: For professionals/executives earning >$4500, companies can define their own policy, but typically follow the 7-14 day minimum or a fixed 14-21 day block.

### B. Sick Leave (Outpatient & Hospitalisation)
*   **Eligibility**: Minimum 3 months of continuous service.
*   **Accrual Steps**:
    | Service Months | Outpatient (Paid) | Hospitalisation (Paid) |
    | :--- | :--- | :--- |
    | 3 | 5 days | 15 days |
    | 4 | 8 days | 30 days |
    | 5 | 11 days | 45 days |
    | 6+ | 14 days | 60 days |
*   **Constraint**: Hospitalisation leave **includes** outpatient sick leave. Total paid sick leave per year is capped at 60 days.

### C. Childcare & Parental Leave (CDCA)
*   **Childcare Leave**: 6 days (SC child <7) or 2 days (Non-SC child <7).
*   **Maternity**: 16 weeks (SC child) or 12 weeks (EA covered).
*   **Paternity**: 2 weeks mandatory (2024). Becomes 4 weeks mandatory from April 2025.

---

## 2. Calculation & Logic Rules

### A. The "Rest Day & Holiday" Exclusion Rule
**CRITICAL**: Under MOM regulations, if a Public Holiday or an employee's Rest Day falls within their leave period, that day **must not be deducted** from their leave balance.

*   **Technical Implementation**:
    1.  Input: `start_date`, `end_date`, `employment_id`, `entity_id`.
    2.  Fetch **Public Holidays** for the `entity_id` within the range.
    3.  Fetch **Rest Day** (e.g., "sunday") from [Employment](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/employment.py#81-115) record.
    4.  Loop through each date from `start` to [end](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/attendance/AttendanceLogs.tsx#12-29):
        *   If date is in PH set -> skip.
        *   If date weekday name == Rest Day -> skip.
        *   Else -> increment `days_count`.

### B. Prorating Formula
For employees joining or leaving mid-year:
`Entitlement = (Full Months Worked / 12 months) * Yearly Entitlement`

*   **Rounding**: MOM recommends rounding fractions of 0.5 and above **up** to the nearest half-day or full day (standard practice is to round to 0.5).

### C. Half-Day Leaves
*   Leave can be taken in half-day increments.
*   Morning Session: Usually 9:00 AM - 1:00 PM.
*   Afternoon Session: Usually 2:00 PM - 6:00 PM.

---

## 3. Automation "Engine" Design

To maintain compliance, the system uses an **Automatic Entitlement Engine**:

1.  **Trigger**: New employee creation or Year-End (Jan 1st).
2.  **Calculation**:
    ```python
    def calculate_new_hire_entitlement(join_date, yearly_entitlement):
        remaining_months = 13 - join_date.month
        return round((remaining_months / 12) * yearly_entitlement, 1)
    ```
3.  **Carry-Forward**: 
    *   Statutory leave must be carried forward to the next 12 months.
    *   Expired leave is automatically forfeited after Dec 31st of the following year.

---

## 4. Required Data Fields for Compliance
*   `Employment.join_date`: To determine eligibility and prorating.
*   `Employment.rest_day`: To exclude weekends correctly.
*   `Person.nationality`: To differentiate between SC (6 days) and Non-SC (2 days) childcare leave.
*   `Person.date_of_birth`: To verify parental leave eligibility.
