# Leave Management Deep Dive

The Leave Management module is designed to handle complex Singapore-specific requirements, especially for employees working across multiple entities.

## 1. Statutory Compliance (MOM Mandated)
The system seeds and enforces MOM-mandated leave types as defined in the **Employment Act**.

| Leave Type | Duration (Statutory) | Business Rule |
| :--- | :--- | :--- |
| **Annual Leave** | 7–14 days | Prorated for new joiners; carry-forward supported. |
| **Medical Leave** | 14 days | Requires MC document upload for approval. |
| **Hospitalisation** | 60 days | Includes the 14 days of Medical Leave. |
| **Maternity/Paternity** | 16 / 2 weeks | Gov-paid child-related leave tracking. |
| **Childcare Leave** | 6 days | For parents of SG citizens < 7 years old. |

## 2. Multi-Entity & Multi-Employment Logic
One of the core features of HRMS V2 is how it handles individuals working for multiple companies under the same tenant.

*   **Employment-Scoped Balances**: `leave_entitlements` are linked to `employment_id`, NOT `person_id`. An employee earns leave separately in each company.
*   **Cross-Entity Overlap Check**: When an employee applies for leave in Entity A, the system auto-scans for existing applications in Entity B for the same dates.
*   **Warn, Don't Block**: The system logs overlaps in `leave_cross_entity_checks` but does NOT prevent the application. HR/Managers resolve overlaps manually (e.g., a PH falling on a rest day in one entity vs. a work day in another).

## 3. Proration & Encashment
*   **Proration Formula**: `(Full Entitlement / 12) * Months Remaining`, rounded to the nearest 0.5 day. Calculated automatically upon onboarding.
*   **Encashment**: On resignation, the system computes the value of unused leave based on the `basic_salary / 22` or `26` (depending on the work week).
*   **Unpaid Leave (UPL)**: Directly integrated with the Payroll Engine. `deduction = (Basic / Total Working Days) * UPL Days`.

## 4. AI & Approvals
*   **AI Conflict Checking**: `leave_conflict_ai` analyzes historical patterns (e.g., "Ahmad often takes MC on Mondays") and highlights team-wide conflicts (e.g., "50% of the kitchen staff is on leave this Friday").
*   **Managed Departments**: Managers with `managed_department_ids` can only approve leave for employees within their assigned scopes.

## 5. Public Holidays
*   **Shared Calendar**: A global `public_holidays` table stores gazetted Singapore holidays.
*   **Substitution**: If a PH falls on a rest day (Saturday), the system prompts for a substitute day off (Monday) per entity policies.
