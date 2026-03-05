# Implementation Plan — Phase 2A: Pool Linkage & Onboarding Auto-Grant

This phase focuses on fixing the data gap for shared leave pools and automating the initial leave grant for new employees.

## Proposed Changes

### 1. Pool Linkage Setup Script [NEW]
Create a one-time setup script to bridge existing data to the new Phase 1 architecture.
#### [NEW] [link_leave_pools.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/scripts/link_leave_pools.py)
- Iterate all entities in the DB.
- Create `SICK_POOL` with `cap_days=60` if missing.
- Link `SICK` leave type: `pool_id = SICK_POOL.id`, `pool_sub_cap = 14`.
- Link `HOSPITALISATION` leave type: `pool_id = SICK_POOL.id`, `pool_sub_cap = null`.

---

### 2. Leave Service Refactor
Add support for auto-granting entitlements.
#### [MODIFY] [leave.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py)
- New method `grant_initial_entitlements(employment_id: uuid.UUID)`:
  - Fetch all active [LeaveType](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/leave.py#80-98)s for the entity.
  - Calculate entitlement using [resolve_entitlement](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#132-157).
  - Create [LeaveEntitlement](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/leave.py#100-112) record for the current year.

---

### 3. Employee Service Integration
Trigger auto-grant during onboarding.
#### [MODIFY] [employee.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/employee.py)
- Import [LeaveService](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#31-713).
- In [create_employee](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/employee.py#27-65), after flushing the [Employment](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/employee.py#37-62) record:
  - Call `leave_service.grant_initial_entitlements(employment.id)`.

## Verification Plan

### Automated Tests
- Run `link_leave_pools.py` and verify [leave_types](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/leave.py#151-163) records in DB.
- Use a test script to call [create_employee](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/employee.py#27-65) and verify `leave_entitlements` are created.

### Manual Verification
1. Run the script: `python3 scripts/link_leave_pools.py`.
2. Check [balances](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#428-543) for an existing employee to ensure SICK pool logic is now active.
3. Onboard a new employee via the UI and verify their "Leave Balances" tab is immediately populated with correct statutory days.
