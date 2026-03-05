# Implementation Plan: Phase 5 - Reporting & Statutory Submissions

This phase focuses on generating regulatory-compliant files for Singapore's statutory bodies (MOM, IRAS, CPF Board).

## User Review Required

> [!WARNING]
> **Mock Data Protection**: For the initial implementation, the CPF91/IR8A files will use mock entity data (UEN etc.) unless the User provides valid test credentials for these statutory fields.

## Proposed Changes

### 1. Backend: Reporting Service 
Enhance the core reporting logic to support monthly and yearly statutory submissions.
*   #### [MODIFY] [reporting.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/reporting.py)
    - Implement [generate_ir8a_report](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/reporting.py#64-68): Aggregate payroll records for a given calendar year.
    - Refine [generate_cpf91_report](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/reporting.py#17-63): Pull real UEN and advice codes from the [Entity](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/tenant.py#46-64) model.
*   #### [MODIFY] [reporting.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/reporting.py)
    - Implement the IR8A generation route.
    - Add a secure, transient download endpoint that streams the generated file content.

### 2. Frontend: Reporting UI
Provide HR Managers with a dedicated section to generate and download compliance files.
*   #### [MODIFY] [Reports.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/Reports.tsx)
    - Connect the "Generate" button to the real API.
    - Integrate with `AuthStore` to fetch the `selected_entity_id`.
    - Fix missing iconography and styling issues (e.g., `ShieldCheck` import).
    - Add a "History" table to show recently generated reports (Mocked for now).

## Verification Plan

### Automated Tests
*   **Generator Logic**: Run unit tests on [CPF91Generator](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/utils/generators/cpf91.py#4-95) to ensure output matches the 150-byte fixed-width standard.
*   **Aggregation Logic**: Verify [IR8AGenerator](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/utils/generators/ir8a.py#5-41) correctly sums 12 months of payroll for an employee.

### Manual Verification
1.  **CPF91 Check**: Generate a CPF91 file for Feb 2026, download it, and verify the record count matches the 2 seeded employees.
2.  **IR8A Check**: Generate an IR8A XML for 2026 and verify the XML tags (GrossSalary, CPF, etc.) contain correct aggregate values.
