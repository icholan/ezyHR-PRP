# HRMS V2: Tech Stack Deep Dive

Based on the [hrms_business_flow_v2.docx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/hrms_business_flow_v2.docx), here is the detailed breakdown of the technical components and implementation strategy.

## 1. Core Technologies
The platform is built on a modern, high-performance stack optimized for Singapore data residency and compliance.

*   **Frontend**: ReactJS 18 + TypeScript + Tailwind CSS.
*   **Backend**: Python FastAPI (Asynchronous) + Celery (Background Tasks).
*   **Database**: PostgreSQL 15 (Relational) + Redis (Broker/Cache).
*   **Infrastructure**: AWS (ap-southeast-1, Singapore).
*   **Services**: Stripe (Billing), SendGrid (Email), Anthropic (Claude AI).

## 2. Infrastructure & Security Layers
The architecture is designed with "Compliance by Design":

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Data Residency** | AWS ap-southeast-1 | Ensures PDPA compliance for personal data. |
| **Object Storage** | AWS S3 | Private bucket; presigned URLs (15-min) for all documents. |
| **PII Encryption** | AES-256 Fernet | NRIC and Bank Accounts encrypted *before* DB write. |
| **Auth** | JWT (Multi-role) | Separate JWT types for `platform_admin` vs `tenant_user`. |
| **Audit** | JSONB + Mixins | Every write operation (I/U/D) tracked with old/new values. |

## 3. Implementation Phases (Build Order)
The business flow outlines a 12-phase build order for developers:

1.  **Phase 1-2 (Foundation)**: Dockerize DB/Redis, run the 52-table schema, and generate SQLAlchemy models with `AuditMixin`.
2.  **Phase 3-5 (Auth & Access)**: Build separate auth flows for Platform Admins (with MFA) and Tenants, plus the `user_entity_access` RBAC.
3.  **Phase 6-7 (Core Engines)**: Implement the "Person" identity and the stateless Calculation Engines (CPF, OT, SDL, SHG) with full unit testing.
4.  **Phase 8-10 (Workflow logic)**: Attendance tracking, Celery-driven payroll runs, and multi-entity leave overlap checks.
5.  **Phase 11-12 (Regulatory & AI)**: Statutory file generation (CPF91, AIS) and integration with the Claude API for payroll auditing.

## 4. Key Environment Variables
Selected critical variables required for deployment:
*   `ENCRYPTION_KEY`: For AES-256 Fernet (NRIC/Bank).
*   `DATABASE_URL`: Asynchronous connection for FastAPI (`postgresql+asyncpg`).
*   `PLATFORM_TOKEN_EXPIRE_HOURS`: Strict 8-hour expiry for admins (no refresh tokens).
*   `S3_BUCKET_NAME`: Dedicated Singapore-region bucket.
*   `ANTHROPIC_API_KEY`: For Claude Sonnet 3.5 (Anomaly detection).

## 5. Security Checklist
1.  **Tenant Isolation**: Strict `tenant_id` injection from JWT into every DB query.
2.  **Impersonation**: Support admins get 15-min sessions, must provide reason, all writes flagged.
3.  **MFA**: Mandatory TOTP for Platform Admins; no SMS fallback allowed.
4.  **PDPA**: `/data-export` and `/data-deletion` endpoints implemented to satisfy "Right of Access" and "Right to Erasure".
