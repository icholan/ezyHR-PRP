# OT Engine & AI Audit Flags Deep Dive

This document details the complex Overtime (OT) calculations and the AI-driven auditing system used in the HRMS platform.

## 1. Overtime (OT) Calculation Engine
The engine is built around the **Singapore Employment Act (Part IV)**, which mandates specific rates for employees earning $\le$ $2,600/month.

### Hourly Rate Calculation
*   **Monthly Rate**: Basic Salary.
*   **Divisor**: **209** (Fixed by MOM).
*   **Formula**: `Hourly Rate = Basic Salary / 209`.

### Rate Matrix
| Day Type | First 8 Hours | Beyond 8 Hours |
| :--- | :--- | :--- |
| **Normal Day** | 1.0x (Included in Basic) | **1.5x** |
| **Rest Day** | 1.0x (or 2.0x if > half day) | **2.0x** |
| **Public Holiday** | **2.0x** (From hour 1) | **2.0x** |

### Critical Constraints
*   **72-Hour Cap**: Monthly OT is capped at 72 hours.
*   **System Action**: Highlighting violations in `monthly_ot_summary` (`exceeds_72hr_limit=true`).
*   **Eligibility**: Automated flag based on salary threshold and job role (Manual overrides possible via `ot_settings`).

---

## 2. AI Audit Flags (Anomaly Detection)
The system uses **Claude 3.5 Sonnet** to audit every payroll run before approval.

### Analysis Context
The AI receives a JSON payload containing:
1.  **Current Month**: Detailed payroll records + items.
2.  **History**: 6-month historical averages per employee.
3.  **Entity Context**: CPF/SHG expectations for Singapore.

### Detection Categories (`ai_audit_flags`)
*   **Salary Spikes**: Increases > 20% vs historical average without an associated `salary_structures` update.
*   **CPF Drops**: NRIC/Citizenship is PR/Citizen but CPF is 0 (Systemic risk).
*   **Bank Matches**: Multiple employees sharing the same bank account digits (Ghost employee detection).
*   **OT Proximity**: Employees nearing the 72-hour statutory cap.

### Business Workflow
*   **Status**: Payroll stays in `pending_approval` until all flags are resolved.
*   **Resolution**: HR must **Fix** (Update record) or **Dismiss** (with a mandatory reason field).
*   **Audit Trail**: Dismissal reasons are saved to `ai_audit_flags.dismissed_reason` and logged for compliance audits.

---

## 3. Tech Implementation (Celery & Python)
*   **OT Engine**: Implemented as a pure Python class (`OTCalculationEngine`) for easy unit testing.
*   **AI Engine**: An asynchronous task triggered after the payroll engine finishes writing records.
*   **Async Processing**: Celery handles the LLM latency (approx. 5-10 seconds per 100 employees) to keep the UI responsive.
