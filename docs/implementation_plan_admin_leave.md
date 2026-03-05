# Admin Leave Management Implementation Plan

This plan outlines the steps to enable administrative leave management features in ezyHR, allowing admins and managers to oversee all employee leaves, edit requests, and apply leave on behalf of others.

## User Review Required

> [!IMPORTANT]
> - **Permissions**: Currently, we will assume anyone with access to the "Management" tab (logic to be defined via [current_user](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/dependencies.py#14-54) roles) can edit any leave within their entity.
> - **Data Consistency**: Editing a "Pending" leave is straightforward. Approved leaves, when edited, may require re-validating balances or recalculating [AttendanceLogs](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/attendance/AttendanceLogs.tsx#30-351). For now, we'll focus on status changes and basic info updates.

## Proposed Changes

---

### Backend: Leave Service & API

#### [MODIFY] [leave.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py)
- **`update_leave_request`**: 
    - Handle transitions: `pending` -> `approved` (subtract from `pending_days`, add to `used_days` if entitlement exists).
    - Handle transitions: `pending` -> `rejected` (subtract from `pending_days`).
    - Support updating `start_date`, `end_date`, and `leave_type_id` (requires re-running day calculation and entitlement checks).
- **`get_entity_leave_requests`**:
    - Fetch all [LeaveRequest](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/leave.py#33-47) for a given `entity_id`.
    - Join with [Employment](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/employment.py#81-115) and [Person](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/employment.py#8-30) to return `full_name` and `employee_code`.

#### [MODIFY] [leave.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/leave.py)
- **`GET /requests`**: Update to accept `entity_id`. If provided, return all requests for the company.
- **`PUT /requests/{request_id}`**: New endpoint to update leave status or data.

---

### Frontend: UI Enhancements

#### [MODIFY] [LeaveManagement.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/LeaveManagement.tsx)
- **View Toggle**: Add a "My Leaves" / "Team Management" toggle for admins.
- **Global Leave Table**:
    - Columns: Employee Name, Leave Type, Period, Days, Status, Actions.
    - Status Badges: Interactive for admins (Approve/Reject).
- **Enhanced Apply Modal**:
    - Add an [Employee](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/attendance/PunchHistory.tsx#71-82) searchable select/dropdown (only visible in Management mode).
    - Allow setting `employment_id` dynamically.
- **Edit Modal**:
    - Reuse/Extend the Apply modal to support editing existing requests.

## Verification Plan

### Automated Tests
- **Backend Tests**: 
    - Script to test `update_leave_request` state transitions.
    - Verify `GET /requests?entity_id=...` returns the correct employee data.

### Manual Verification
1. Login as Admin.
2. Toggle to "Team Management".
3. Apply leave for another employee.
4. Approve/Reject an employee's leave request.
5. Edit an existing leave request and verify balance consistency.
