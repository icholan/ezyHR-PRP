# Platform Admin Tools Deep Dive

The **Layer 0 (Platform Admin)** layer is completely decoupled from the tenant logic, designed for SaaS operators to manage the lifecycle and support of all tenants.

## 1. Governance & Access Control
Unlike tenant users, Platform Admins operate on a global scale with specialized roles.

*   **Authentication**: Separate portal (`admin.yourhrms.com`) with a dedicated `platform_admins` table.
*   **MFA**: Mandatory TOTP; no bypass for any role.
*   **JWT Security**: Issued with `type: platform_admin`. This token is rejected by all `/api/v1/` tenant-scoped endpoints to prevent privilege escalation.

| Role | Permissions |
| :--- | :--- |
| **super_admin** | Full CRUD on everything + Delete Tenants + Manage other Admins. |
| **admin** | Manage tenants and feature flags; cannot delete tenants. |
| **support** | Read-only access + **Impersonation** (for troubleshooting). |
| **billing** | Access to Stripe data, MRR metrics, and invoices only. |

## 2. Support Impersonation (Flow 0C)
Designed to assist users while maintaining a strict audit trail.

*   **Mechanism**: Support admin requests a temporary 15-minute JWT (`type: impersonation`) for a specific tenant user.
*   **Mandatory Reason**: Cannot start a session without a logged reason (`impersonation_sessions.reason`).
*   **Audit Trail**: Every database write during a session is flagged with `impersonated_by` (admin ID) and the `impersonation_session_id`.
*   **PDPA Compliance**: Impersonation logs are immutable and can be exported for a tenant under their "Right of Access."

## 3. Feature Flags & Gradual Rollout
The `feature_flags` system allows the operator to control the release of advanced (especially AI) features.

*   **Granular Control**: Flags can be enabled globally, for specific `enabled_tenant_ids`, or excluded for `disabled_tenant_ids`.
*   **Rollout Strategy**: Supports `rollout_percentage` (0-100) for A/B testing or staged stability checks.
*   **AI Gating**: All new V2 features (Anomaly detection, MOM Copilot, Attrition scores) are gated behind these flags.

## 4. Tenant Lifecycle Management
*   **Suspension**: Admins can set `tenants.suspended_at`, which triggers an immediate 403 for all users under that tenant.
*   **Trial Extensions**: Direct control over `subscriptions.trial_end` without manual Stripe intervention.
*   **Hard Delete**: Restricted to `super_admin` with a 24-hour delay and confirmation logic to purge both Database and S3 records.

## 5. Implementation Summary
*   **Separate Router**: Platform endpoints reside under `/platform/` instead of `/api/v1/`.
*   **Observability**: `platform_audit_logs` tracks every action (LOGIN, IMPERSONATE_START, PLAN_CHANGE) with 7-year retention.
*   **Tenant Health**: Dashboard displays aggregate MRR, churn, and system health status.
