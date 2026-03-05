# HRMS V2: Architecture & Business Flow Analysis

This document provides a comprehensive analysis of the updated Singapore HRMS SaaS platform based on the provided SQL schema ([hrms_complete_schema_v2.sql](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/hrms_complete_schema_v2.sql)) and business flow document ([hrms_business_flow_v2.docx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/hrms_business_flow_v2.docx)).

## 1. System Architecture & Hierarchy
The system follows a strict **5-Layer Hierarchy** designed for multi-tenant scalability and Singapore compliance:

*   **Layer 0: Platform Admin**: SaaS operators managing tenants, feature flags, and support-driven impersonation.
*   **Layer 1: Tenant**: Top-level billing account (e.g., a holding company or a group of companies).
*   **Layer 2: Entity**: Individual Pte Ltd companies under a tenant (each with its own UEN, CPF account, and IRAS ref).
*   **Layer 3: User**: Access control layer using RBAC (hr_admin, manager, viewer, employee) assigned per entity.
*   **Layer 4: Person & Employment**: 
    *   **Persons**: Master identity (1 NRIC = 1 record).
    *   **Employments**: Active job contracts. A single person can have multiple simultaneous employments across different entities within the same tenant.

## 2. Database Schema Overview (52 Tables)
The database is structured into 14 logical layers:
1.  **Platform Admin (5 tables)**: Handle SaaS-wide operations, audit logs, and MFA.
2.  **Tenant & Entity (2 tables)**: Basic organization data.
3.  **User & Access (2 tables)**: Authentication and granular RBAC.
4.  **People & Employment (5 tables)**: Core human and job data.
5.  **Payroll (4 tables)**: Runs, records, and detailed items.
6.  **CPF (4 tables)**: Statutory contributions (rates, submissions, cross-entity summaries).
7.  **SHG/SDL/FWL (3 tables)**: Self-Help Groups, Skill Development Levy, and Foreign Worker Levy.
8.  **Leave (5 tables)**: Entitlements, applications, and **Cross-Entity Overlap Checks**.
9.  **Claims (2 tables)**: Expense management.
10. **IRAS / Tax (3 tables)**: IR8A, Appendix 8A, and AIS submissions.
11. **Time & Attendance (10 tables)**: Shifts, rosters, clock-ins, and complex OT calculations.
12. **Billing (3 tables)**: Subscription and Stripe integration.
13. **Audit & System (3 tables)**: Global audit logs and document storage.
14. **AI Features (3 tables)**: Payroll anomaly flags, chat sessions, and attrition risk scores.

## 3. Critical Singapore Compliance Rules
The system is "Singapore-First," hardcoding specific compliance logic into the flow:

| Feature | Statutory Rule | Implementation Detail |
| :--- | :--- | :--- |
| **CPF Ceiling** | OW: $6,800/mo | Applied per employment; YTD cross-entity tracking for AW ($102k/yr). |
| **OT Pay** | 1.5x / 2.0x | Divisor = 209 (Basic salary / 209). Mandatory for basic <= $2,600. |
| **OT Cap** | 72 hours/mo | Flagged and capped in payroll (MOM Employment Act s.38). |
| **SHG** | CDAC, etc. | Mapped via Race/Nationality (Citizens/PRs only). |
| **SDL** | 0.25% of Gross | Min $2.00, Max $11.25. Applies to all (including foreigners). |
| **Work Pass** | MOM Criteria | Alerts at 6/3/1 month; tracks min qualifying salary for renewals. |

## 4. Advanced AI Integration
The V2 schema introduces sophisticated AI features using **Claude (claude-sonnet-4-20250514)**:
*   **AI Payroll Audit**: Scans for anomalies (salary spikes, CPF drops, duplicate bank accounts) vs. 6-month historical data.
*   **MOM Copilot**: LLM-powered compliance assistant for HR queries.
*   **Predictive Attrition**: Scoring based on attendance patterns (MC spikes), tenure, and peer-group salary comparison.
*   **IR8A Pre-Check**: AI validation of tax data vs. payroll records before IRAS filing.

## 5. Security & Privacy
*   **Data Residency**: All AWS services in `ap-southeast-1` (Singapore) for PDPA compliance.
*   **Encryption**: PII (NRIC/FIN) and sensitive financial data (Bank Accounts) are encrypted using **AES-256 Fernet** at the application layer.
*   **Tenant Isolation**: Strict `tenant_id` filtering on every query.
*   **Impersonation**: Audit-logged, 15-minute max duration, mandatory reason field.

## 6. Development Priorities (Build Order)
Based on the business flow, the recommended implementation sequence is:
1.  **Core Infra**: PostgreSQL/Redis + 52 SQLAlchemy models with AuditMixin.
2.  **Auth & Access**: MFA-enabled platform admin vs. tenant-scoped RBAC.
3.  **Human Capital**: Person/Employment + Encryption Layer.
4.  **The Engines**: OT, CPF, SHG, and SDL calculation engines (Unit tested).
5.  **Payroll & Leave**: Celery-driven payroll processing + cross-entity leave checking.
6.  **AI Layer**: Integration with Anthropic API for anomaly detection and attrition scoring.
