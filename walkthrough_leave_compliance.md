# Walkthrough: MOM Leave Compliance Implementation (Phase 1 & 2)

This document provides a detailed walkthrough of the implementation and verification of Singapore Ministry of Manpower (MOM) compliant leave rules in ezyHR.

---

## 1. Phase 1: Correct Day Calculation
**Objective**: Ensure weekends (Rest Days) and Public Holidays are not deducted from an employee's leave balance.

### Implementation Details
- **PH Exclusion**: Integrated [LeaveService](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#11-327) with `AttendanceService.get_ph_dates_set` to identify and skip public holidays within a leave range.
- **Rest Day Exclusion**: Retrieves the designated `rest_day` from the [Employment](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/employment.py#81-115) record (defaults to Sunday) and skips it during calculation.

### Verification Results
| Scenario | Input Range | Expected Days | Actual Result |
| :--- | :--- | :--- | :--- |
| **Standard Week** | Mon - Fri | 5.0 | 5.0 ✅ |
| **Weekend Cross** | Fri - Mon | 3.0 (Skips Sun) | 3.0 ✅ |
| **Public Holiday** | Includes Labor Day | -1 Day for PH | Correctly Skipped ✅ |

---

## 2. Phase 2: Accrual & Eligibility Engine
**Objective**: Automate statutory entitlements, tenure barriers, and complex caps.

### A. The 3-Month Tenure Barrier
- **Rule**: Statutory paid leave is only available after 3 months of service.
- **Verification**: Attempted to apply leave for a new hire with 30 days tenure.
- **Result**: System successfully raised `ValueError: Statutory paid leave is only available after 3 months of service.` ✅

### B. Sick Leave Step-Up Schedule
- **Rule**: Entitlement increases with tenure (5/8/11/14 days).
- **Verification**: Verified balances for an employee with 4 months of service.
- **Result**: `SICK` total = 8.0, `HOSPITALISATION` total = 30.0. ✅

### C. Shared Hospitalisation Cap
- **Rule**: Hospitalisation (60 days) includes Outpatient Sick Leave.
- **Verification**: Employee used 4 days of Sick Leave.
- **Result**: Hospitalisation available balance automatically showed **56.0** (60 - 4). ✅

### D. Annual Leave Staircase
- **Rule**: 7 days base, +1 day per year of service, capped at 14.
- **Verification**: Employee with 24 months (2 years) tenure checked.
- **Result**: Annual Leave Total = **9.0** (7 + 2). ✅

---

## 3. Technical Components Modified
- [leave.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py): Core logic for [apply_leave](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#79-245) and [get_balances](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#246-327) refactored for dynamic calculations.
- **MOM Helpers**: Added [get_tenure_months](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#15-21), [get_statutory_sick_limits](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#29-36), and [get_statutory_annual_limit](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#22-28).

## 4. Next Steps
- **Phase 3**: Update Frontend UI to display these dynamically calculated "Accrued" balances and tenure status to the user.
