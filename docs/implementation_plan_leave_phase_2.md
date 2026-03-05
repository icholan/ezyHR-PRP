# Implementation Plan - MOM Leave Accrual Engine (Phase 2)

This phase focuses on automating leave entitlements to ensure compliance with Singapore's statutory requirements (EA/CDCA).

## Proposed Changes

### [Leave Backend]

#### [MODIFY] [leave.service.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py)

**1. Tenure Validation (The 3-Month Barrier)**
- Update [apply_leave](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#50-144) to calculate tenure: `current_date - employment.join_date`.
- If tenure < 90 days and `leave_type.is_statutory` is True, raise a `ValueError` (or force as unpaid).

**2. Dynamic Sick Leave Step-Up**
- Implement a helper `get_accrued_sick_limits(join_date)` that returns the 5/8/11/14 step-up days based on months of service.
- Use these dynamic limits during validation instead of the static `total_days` in the database.

**3. Shared Sick Leave Cap (60-Day Protection)**
- Update validation logic for Sick/Hospitalisation leave.
- Formula: `Available Hospitalisation = 60 - (Used Outpatient Sick Leave)`.
- Ensure the sum of both never exceeds 60 days in a calendar year.

**4. Annual Leave Escalation Formula**
- Implement `get_statutory_annual_entitlement(join_date)`:
  - Base = 7 days.
  - Increment = +1 day for every completed year of service.
  - Cap = 14 days.

**5. New Hire Pro-rating Helper**
- Add logic to calculate first-year pro-rated days: `round((RemainingMonths / 12) * Entitlement, 1)`.

---

## Verification Plan

### Automated Tests
- **Accrual Logic Script**: A scratch script to verify:
  - An employee with 4 months tenure gets 8 days sick leave.
  - An employee with 2 years tenure gets 9 days annual leave.
  - Hospitalisation balance reduces correctly when outpatient sick leave is used.

### Manual Verification
1. Create a new employee with a `join_date` from 2 months ago.
2. Attempt to apply for Annual Leave (expect block/error).
3. Update `join_date` to 4 months ago.
4. Verify Sick Leave balance shows 8 days (step-up).
5. Apply for 10 days of Sick Leave and then check if Hospitalisation balance is correctly adjusted.
