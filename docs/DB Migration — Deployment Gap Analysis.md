# DB Migration — Deployment Gap Analysis

## ⚠️ Critical Finding: Fresh Deployment Will FAIL

> [!CAUTION]
> If you deploy to a **new environment** (e.g. Railway) with an empty database and run `alembic upgrade head`, **it will NOT create any tables**. It will fail because the existing migrations only add columns to an already-existing `persons` table.

### Why?

| What | Status |
|------|--------|
| Tables in DB (current local) | **41** app tables + `alembic_version` |
| Tables in SQLAlchemy models | **41** |
| Tables created by Alembic migrations | **0** ❌ |
| Columns added by migrations | 3 (`mobile_number`, `whatsapp_number`, `language`) |
| Schema fixes by migrations | 1 (`departments.is_active` nullable) |

The tables were originally created via `Base.metadata.create_all()` (or raw SQL), NOT through Alembic. The two existing migrations only handle **incremental changes**.

### The Fix

We need a **baseline migration** that creates all 41 tables. This is migration `0000` that runs before `0001`. On your existing local DB it will be skipped (already stamped), but on a fresh Railway DB it will create everything from scratch.

> [!IMPORTANT]
> I recommend creating this baseline migration as a next step. Say "create baseline migration" and I'll generate it.

---

## All 41 Application Tables

### 🏢 Tenant & Auth (6 tables)

| # | Table | Columns | Description |
|---|-------|---------|-------------|
| 1 | `platform_admins` | 15 | Super-admin accounts |
| 2 | `tenants` | 19 | Multi-tenant organizations |
| 3 | [entities](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/entities.py#15-34) | 16 | Companies under a tenant |
| 4 | `users` | 15 | Tenant user accounts |
| 5 | `roles` | 6 | Role definitions |
| 6 | `role_permissions` | 2 | Role → permission mapping |

### 👥 People & Employment (9 tables)

| # | Table | Columns | Description |
|---|-------|---------|-------------|
| 7 | `persons` | 17 | Personal data (NRIC encrypted) |
| 8 | `employments` | 24 | Employment records per person |
| 9 | [departments](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/masters.py#30-39) | 9 | Department hierarchy |
| 10 | [grades](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/masters.py#84-93) | 8 | Employee grade levels |
| 11 | [groups](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/masters.py#138-147) | 8 | Employee groups |
| 12 | [customers](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/masters.py#192-201) | 12 | Client/customer records |
| 13 | `bank_accounts` | 8 | Employee bank details (encrypted) |
| 14 | `user_entity_access` | 9 | User ↔ Entity RBAC |
| 15 | `work_passes` | 9 | Work permit tracking |

### 💰 Payroll (5 tables)

| # | Table | Columns | Description |
|---|-------|---------|-------------|
| 16 | `salary_structures` | 10 | Pay components per employee |
| 17 | `payroll_runs` | 21 | Monthly payroll batches |
| 18 | `payroll_records` | 25 | Individual payslip records |
| 19 | `audit_flags` | 12 | Payroll audit flags |
| 20 | `claim_applications` | 10 | Employee expense claims |

### 🏛️ Statutory / CPF (4 tables)

| # | Table | Columns | Description |
|---|-------|---------|-------------|
| 21 | `cpf_rate_config` | 12 | CPF rate tables |
| 22 | `cpf_submissions` | 15 | CPF filing records |
| 23 | `shg_rate_config` | 9 | SHG fund rates |
| 24 | `sdl_rate_config` | 8 | SDL levy rates |

### 📋 Leave (3 tables)

| # | Table | Columns | Description |
|---|-------|---------|-------------|
| 25 | `leave_types` | 9 | Leave type definitions |
| 26 | `leave_entitlements` | 10 | Annual leave balances |
| 27 | `leave_requests` | 14 | Leave applications |

### ⏰ Attendance (5 tables)

| # | Table | Columns | Description |
|---|-------|---------|-------------|
| 28 | `shifts` | 11 | Shift definitions |
| 29 | `shift_roster` | 8 | Employee shift assignments |
| 30 | `attendance_records` | 10 | Clock-in/out records |
| 31 | `daily_attendance` | 16 | Daily attendance summary |
| 32 | `monthly_ot_summary` | 13 | Monthly OT aggregation |

### 🤖 AI Features (3 tables)

| # | Table | Columns | Description |
|---|-------|---------|-------------|
| 33 | `ai_audit_flags` | 14 | AI-generated payroll flags |
| 34 | `ai_chat_sessions` | 12 | AI chat history |
| 35 | `ai_attrition_scores` | 13 | Employee attrition risk |

### 📄 Tax & Claims (1 table)

| # | Table | Columns | Description |
|---|-------|---------|-------------|
| 36 | `ir8a_records` | 12 | IR8A annual tax filings |

### 🔧 System (5 tables)

| # | Table | Columns | Description |
|---|-------|---------|-------------|
| 37 | `subscriptions` | 8 | SaaS plan subscriptions |
| 38 | `audit_logs` | 11 | Tenant-level audit trail |
| 39 | `system_audit_logs` | 7 | Platform admin audit trail |
| 40 | `notifications` | 7 | User notifications |
| 41 | `document_storage` | 9 | File/document references |

---

## Current Migration Chain

```
<base> → 0001 (add person contact fields) → cfeca44774b9 (head)
```

## What's Needed for Fresh Deployment

```
<base> → 0000 (CREATE ALL 41 tables) → 0001 → cfeca44774b9 (head)
              ↑ THIS IS MISSING
```
