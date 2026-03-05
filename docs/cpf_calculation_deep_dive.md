# CPF Calculation Logic Deep Dive

Based on the [hrms_complete_schema_v2.sql](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/hrms_complete_schema_v2.sql) and [hrms_business_flow_v2.docx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/hrms_business_flow_v2.docx), here is the detailed breakdown of the CPF calculation engine.

## 1. Statutory Rules & Ceilings (2024–2026)
The system enforces the following rules precisely as mandated by the CPF Board:

| Component | Rule/Value | Purpose |
| :--- | :--- | :--- |
| **Eligibility** | Citizens & PRs only. | Foreigners (EP, S-Pass, WP) = 0%. |
| **OW Ceiling** | **$6,800** per month. | Max monthly wage subject to CPF. |
| **AW Ceiling** | **$102,000** - (Total OW for the year). | Max annual wage subject to CPF. |
| **Age-Based Rates** | Graduated rates at 55, 60, 65, 70. | Stored in `cpf_rate_config` table. |
| **PR Rates** | 3-year graduated scale. | `pr_yr1`, `pr_yr2`, `pr_yr3`. |

## 2. Calculation Engine Flow
The `CPFCalculationEngine` follows a specific 5-step sequence:

1.  **Identify Citizenship Type**:
    *   If `citizenship_type` is not `citizen` or `pr`, CPF = 0.
2.  **Lookup Rates**:
    *   Find the rate in `cpf_rate_config` using current `age`, `citizenship_type`, and `effective_date` (month of payroll).
3.  **Ordinary Wage (OW) CPF**:
    *   `eligible_ow = min(gross_ow, 6800)`
    *   `cpf_ee_ow = round(eligible_ow * employee_rate)`
    *   `cpf_er_ow = round(eligible_ow * employer_rate)`
4.  **Additional Wage (AW) CPF**:
    *   The system uses the `person_cpf_summary` table to track YTD OW across **all entities** for a person.
    *   `remaining_aw_ceiling = 102000 - ytd_ow`
    *   `eligible_aw = min(gross_aw, max(0, remaining_aw_ceiling - ytd_aw_calculated))`
5.  **Final Totals**:
    *   Combined Employee and Employer contributions are saved to `payroll_records`.

## 3. Data Structure (Multi-Entity Support)
The system handles the complex requirement of one person working for multiple entities:

*   **`cpf_rate_config`**: Never hardcoded; updated annually via migrations.
*   **`person_cpf_summary`**: A cross-entity table. While each entity files CPF *independently*, the **AW ceiling** must be checked against the person's total income within the tenant.
*   **`cpf_submission_lines`**: Granular breakdown per employee for generating the `CPF91` fixed-width file.

## 4. Key Business Warning (Multi-Employment)
> [!IMPORTANT]
> Per the CPF Act, the **OW Ceiling ($6,800)** applies to **each employment individually**. If a person earns $5,000 at Company A and $3,000 at Company B, both companies contribute CPF on the *full* amount (no aggregation for OW). Only the **AW Ceiling** requires cross-entity monitoring.

## 5. Automation & Audit
*   **AI Pre-Check**: The `ir8a_precheck` flag uses the AI engine to validate that the summed monthly CPF contributions match the reported annual totals before IRAS submission.
*   **Late Interest**: Submission is due on the **14th of the following month** (`cpf_submissions.due_date`).
