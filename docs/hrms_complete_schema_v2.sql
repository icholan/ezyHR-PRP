-- ============================================================
-- SINGAPORE HRMS SAAS — COMPLETE UPDATED DATABASE SCHEMA
-- PostgreSQL 15+
-- 52 Tables | Updated with Platform Admin + AI Features +
--             Multi-Entity Leave + Entity Access Control
-- ============================================================
-- NEW vs original 44-table schema:
--   + platform_admins           (Platform SaaS operator accounts)
--   + platform_audit_logs       (Every platform admin action)
--   + platform_announcements    (System-wide notices)
--   + feature_flags             (Per-tenant feature rollout)
--   + impersonation_sessions    (Support tool audit trail)
--   + ai_audit_flags            (Payroll anomaly detector results)
--   + leave_cross_entity_checks (Multi-entity leave overlap log)
--   + ai_chat_sessions          (MOM Copilot conversation history)
-- ============================================================
-- LAYERS:
--   0.  Platform Admin           (5 tables)  ← NEW
--   1.  Tenant & Entity          (2 tables)  ← updated columns
--   2.  User & Access Control    (2 tables)  ← updated columns
--   3.  People & Employment      (5 tables)
--   4.  Payroll                  (4 tables)
--   5.  CPF                      (4 tables)
--   6.  SHG / SDL / FWL          (3 tables)
--   7.  Leave                    (5 tables)  ← +1 cross entity
--   8.  Claims & Expenses        (2 tables)
--   9.  IRAS / Tax               (3 tables)
--  10.  Work Pass                (2 tables)
--  11.  Time & Attendance       (10 tables)
--  12.  Billing & Subscription   (3 tables)
--  13.  Audit & System           (3 tables)  ← updated
--  14.  AI Features              (3 tables)  ← NEW
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- for fast NRIC/name search

-- ============================================================
-- LAYER 0: PLATFORM ADMIN  (SaaS Operator Layer)
-- Completely separate from tenant users. Never appears in
-- user_entity_access. Separate auth flow with mandatory MFA.
-- ============================================================

CREATE TABLE platform_admins (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255)    UNIQUE NOT NULL,
    password_hash   VARCHAR(255)    NOT NULL,
    full_name       VARCHAR(255)    NOT NULL,
    role            VARCHAR(50)     NOT NULL DEFAULT 'admin',
    -- super_admin | admin | support | billing | readonly
    is_active       BOOLEAN         NOT NULL DEFAULT true,
    mfa_secret      VARCHAR(255),               -- TOTP secret (encrypted)
    mfa_enabled     BOOLEAN         NOT NULL DEFAULT false,
    mfa_backup_codes TEXT[],                    -- hashed backup codes
    last_login_at   TIMESTAMPTZ,
    last_login_ip   INET,
    password_changed_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_by      UUID            REFERENCES platform_admins(id)
);

COMMENT ON TABLE platform_admins IS
    'SaaS operator accounts. Completely separate from tenant users.
     MFA mandatory. Separate JWT type (platform_admin).
     super_admin can create others. support can impersonate tenants.';

COMMENT ON COLUMN platform_admins.role IS
    'super_admin: full access + delete tenants + manage platform admins.
     admin: full access except delete tenant / create super_admin.
     support: read-only + impersonate (audit logged). No writes.
     billing: Stripe + invoices only.
     readonly: view everything, change nothing.';

-- -------------------------------------------------------

CREATE TABLE platform_audit_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id        UUID            NOT NULL REFERENCES platform_admins(id),
    action          VARCHAR(100)    NOT NULL,
    -- LOGIN | LOGOUT | VIEW_TENANT | IMPERSONATE_START | IMPERSONATE_END
    -- SUSPEND_TENANT | REACTIVATE_TENANT | DELETE_TENANT | PLAN_CHANGE
    -- RESET_USER_PASSWORD | FEATURE_FLAG_CHANGE | ANNOUNCEMENT_CREATE
    target_type     VARCHAR(50),    -- tenant | user | entity | feature_flag
    target_id       UUID,
    target_name     VARCHAR(255),
    detail          JSONB,          -- full context (old/new values, reasons)
    ip_address      INET,
    user_agent      VARCHAR(500),
    impersonating_tenant_id UUID REFERENCES tenants(id),  -- set during impersonation
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE platform_audit_logs IS
    'Immutable log of every platform admin action. Cannot be deleted.
     7 year retention. Used for SOC2 / compliance audit.';

-- -------------------------------------------------------

CREATE TABLE platform_announcements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           VARCHAR(255)    NOT NULL,
    body            TEXT            NOT NULL,
    type            VARCHAR(20)     NOT NULL DEFAULT 'info',
    -- info | warning | critical | maintenance
    target          VARCHAR(20)     NOT NULL DEFAULT 'all',
    -- all | specific
    target_tenant_ids UUID[],       -- NULL = all tenants
    show_from       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    show_until      TIMESTAMPTZ,
    is_dismissible  BOOLEAN         NOT NULL DEFAULT true,
    created_by      UUID            NOT NULL REFERENCES platform_admins(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE platform_announcements IS
    'System-wide or tenant-specific notices shown in HR portal.
     Examples: CPF rate changes, scheduled maintenance, new features.';

-- -------------------------------------------------------

CREATE TABLE feature_flags (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key            VARCHAR(100)    UNIQUE NOT NULL,
    -- ai_payroll_audit | mom_copilot | payslip_explainer | attrition_risk
    -- leave_conflict_ai | ir8a_precheck | nl_reports | hr_letter_gen
    description         TEXT,
    is_enabled_globally BOOLEAN         NOT NULL DEFAULT false,
    enabled_tenant_ids  UUID[],         -- specific tenants (overrides global)
    disabled_tenant_ids UUID[],         -- tenants excluded from global rollout
    rollout_percentage  SMALLINT        NOT NULL DEFAULT 0,  -- 0-100
    created_by          UUID            REFERENCES platform_admins(id),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE feature_flags IS
    'Gradual feature rollout per tenant. AI features gated here.
     Check: is_enabled_globally OR tenant_id IN enabled_tenant_ids.';

-- Seed feature flags for all AI features
INSERT INTO feature_flags (flag_key, description, is_enabled_globally) VALUES
('ai_payroll_audit',     'AI anomaly detection before payroll approval', false),
('mom_copilot',          'MOM compliance Q&A chatbot', false),
('payslip_explainer',    'Employee self-service payslip AI explainer', false),
('leave_conflict_ai',    'AI leave conflict analysis for managers', false),
('ir8a_precheck',        'AI IR8A/AIS pre-validation before IRAS submission', false),
('attrition_risk',       'Predictive attrition risk scoring per employee', false),
('nl_payroll_reports',   'Natural language payroll report queries', false),
('hr_letter_generator',  'One-click MOM-compliant HR letter generation', false),
('work_pass_ai',         'AI work pass renewal checklist and alerts', false);

-- -------------------------------------------------------

CREATE TABLE impersonation_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_admin_id   UUID            NOT NULL REFERENCES platform_admins(id),
    tenant_user_id      UUID            NOT NULL REFERENCES users(id),
    tenant_id           UUID            NOT NULL REFERENCES tenants(id),
    reason              TEXT            NOT NULL,   -- mandatory reason
    token_jti           VARCHAR(255),               -- JWT jti for this session
    started_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    ended_at            TIMESTAMPTZ,                -- NULL = still active
    expires_at          TIMESTAMPTZ     NOT NULL,   -- max 15 min from start
    ip_address          INET,
    actions_count       INTEGER         NOT NULL DEFAULT 0  -- writes done
);

COMMENT ON TABLE impersonation_sessions IS
    'Every support impersonation session. Cannot be deleted.
     Tenant can request this log under PDPA right of access.
     All writes during session flagged with impersonation_session_id
     in audit_logs.impersonated_by.';


-- ============================================================
-- LAYER 1: TENANT & ENTITY
-- ============================================================

CREATE TABLE tenants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255)    NOT NULL,
    subscription_plan   VARCHAR(50)     NOT NULL DEFAULT 'starter',
    -- starter | growth | business | enterprise
    billing_email       VARCHAR(255)    NOT NULL,
    contact_number      VARCHAR(20),
    setup_complete      BOOLEAN         NOT NULL DEFAULT false,
    is_active           BOOLEAN         NOT NULL DEFAULT true,
    -- Platform admin controls below
    suspended_at        TIMESTAMPTZ,
    suspended_reason    TEXT,
    suspended_by        UUID            REFERENCES platform_admins(id),
    trial_ends_at       TIMESTAMPTZ,
    notes               TEXT,           -- internal CS notes
    mrr                 NUMERIC(10,2),  -- monthly recurring revenue (cached)
    assigned_csm        UUID            REFERENCES platform_admins(id),
    -- Stripe
    stripe_customer_id  VARCHAR(100),
    -- PDPA
    data_deletion_requested_at TIMESTAMPTZ,
    data_deletion_completed_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE tenants IS
    'Top-level billing account (e.g. ABC Holdings Pte Ltd).
     One tenant = one Stripe subscription = one group of entities.';

-- -------------------------------------------------------

CREATE TABLE entities (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name                VARCHAR(255)    NOT NULL,
    uen                 VARCHAR(20)     UNIQUE,
    cpf_account_no      VARCHAR(20),
    iras_tax_ref        VARCHAR(20),
    registered_address  TEXT,
    gst_registered      BOOLEAN         NOT NULL DEFAULT false,
    gst_no              VARCHAR(20),
    industry_code       VARCHAR(10),    -- SSIC code (for SDL sector)
    payroll_cutoff_day  SMALLINT        NOT NULL DEFAULT 25,
    payment_day         SMALLINT        NOT NULL DEFAULT 28,
    work_week_hours     NUMERIC(4,2)    NOT NULL DEFAULT 44.0,
    is_active           BOOLEAN         NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE entities IS
    'Individual Pte Ltd company under a tenant.
     Has its own UEN, CPF account, IRAS ref.
     Users are granted access per entity via user_entity_access.';


-- ============================================================
-- LAYER 2: USER & ACCESS CONTROL
-- ============================================================

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email               VARCHAR(255)    UNIQUE NOT NULL,
    password_hash       VARCHAR(255),
    full_name           VARCHAR(255)    NOT NULL,
    is_tenant_admin     BOOLEAN         NOT NULL DEFAULT false,
    -- tenant_admin can manage ALL entities + create users
    -- regular users restricted by user_entity_access
    is_active           BOOLEAN         NOT NULL DEFAULT true,
    two_fa_enabled      BOOLEAN         NOT NULL DEFAULT false,
    two_fa_secret       VARCHAR(255),
    last_login          TIMESTAMPTZ,
    last_login_ip       INET,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS
    'Login accounts for HR admins, managers, employees (tenant side).
     is_tenant_admin = true → can see all entities without explicit access rows.
     Regular users restricted to entities listed in user_entity_access.';

-- -------------------------------------------------------

CREATE TABLE user_entity_access (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_id   UUID        NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    role        VARCHAR(50) NOT NULL,
    -- hr_admin | manager | viewer | employee
    -- hr_admin:  full CRUD + payroll approve + leave approve + CPF
    -- manager:   own dept leave approve + view payroll + attendance
    -- viewer:    read-only across entity
    -- employee:  own records only (self-service portal)
    managed_department_ids UUID[],   -- manager role: departments they oversee
    granted_by  UUID        REFERENCES users(id),
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, entity_id)
);

COMMENT ON TABLE user_entity_access IS
    'Granular entity-level access control.
     One user can have different roles in different entities.
     E.g. hr_admin in Restaurant, viewer in Catering, no access to Warehouse.
     Absence of row = 403 Forbidden on all requests to that entity.';


-- ============================================================
-- LAYER 3: PEOPLE & EMPLOYMENT
-- ============================================================

CREATE TABLE persons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID            NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    full_name       VARCHAR(255)    NOT NULL,
    nric_fin        VARCHAR(20),            -- AES-256 Fernet encrypted at app layer
    nationality     VARCHAR(50),
    race            VARCHAR(50),            -- Chinese | Malay | Indian | Eurasian | Others
    religion        VARCHAR(50),
    date_of_birth   DATE,
    gender          VARCHAR(10),
    contact_number  VARCHAR(20),
    personal_email  VARCHAR(255),
    address         TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, nric_fin)
);

COMMENT ON TABLE persons IS
    'Master identity per human being.
     ONE record per NRIC across all entities under a tenant.
     Allows person to work across multiple entities without data duplication.
     NRIC encrypted before storage, decrypted only in service layer.';

-- -------------------------------------------------------

CREATE TABLE departments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   UUID            NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name        VARCHAR(100)    NOT NULL,
    parent_id   UUID            REFERENCES departments(id),
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE bank_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id       UUID            NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    bank_name       VARCHAR(100)    NOT NULL,
    account_number  VARCHAR(50)     NOT NULL,   -- AES-256 Fernet encrypted
    account_name    VARCHAR(255)    NOT NULL,
    is_default      BOOLEAN         NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN bank_accounts.account_number IS
    'Encrypted at app layer. Decrypted only for GIRO file generation.
     Never logged. Display last 4 digits only.';

-- -------------------------------------------------------

CREATE TABLE employments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id           UUID            NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    entity_id           UUID            NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    employee_code       VARCHAR(50),
    employment_type     VARCHAR(50)     NOT NULL,
    -- full_time | part_time | contract | director | intern
    job_title           VARCHAR(100),
    department_id       UUID            REFERENCES departments(id),
    citizenship_type    VARCHAR(20)     NOT NULL DEFAULT 'citizen',
    -- citizen | pr | ep | s_pass | wp | dp | ltvp
    pr_year             SMALLINT,               -- 1, 2, or 3 (CPF graduated rate)
    work_pass_type      VARCHAR(50),
    work_pass_no        VARCHAR(50),
    work_pass_expiry    DATE,
    join_date           DATE            NOT NULL,
    resign_date         DATE,
    probation_end_date  DATE,
    basic_salary        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    payment_mode        VARCHAR(20)     NOT NULL DEFAULT 'bank_transfer',
    bank_account_id     UUID            REFERENCES bank_accounts(id),
    is_ot_eligible      BOOLEAN         NOT NULL DEFAULT true,
    is_active           BOOLEAN         NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (person_id, entity_id, join_date)
);

COMMENT ON TABLE employments IS
    'Job contract. One person can have multiple SIMULTANEOUS active employments
     across different entities. Each employment is independent:
     separate payroll, separate leave, separate CPF filing.
     OT mandatory for basic_salary <= $2,600 (MOM Part IV EA).';

-- -------------------------------------------------------

CREATE TABLE employee_entity_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id       UUID            NOT NULL REFERENCES persons(id),
    from_entity_id  UUID            REFERENCES entities(id),
    to_entity_id    UUID            REFERENCES entities(id),
    employment_id   UUID            REFERENCES employments(id),
    effective_date  DATE            NOT NULL,
    end_date        DATE,
    reason          VARCHAR(100),
    -- transfer | secondment | promotion | restructure
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- LAYER 4: PAYROLL
-- ============================================================

CREATE TABLE salary_structures (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id   UUID            NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
    component       VARCHAR(100)    NOT NULL,
    -- basic | transport_allowance | meal_allowance | housing | commission | bonus
    amount          NUMERIC(12,2)   NOT NULL,
    is_taxable      BOOLEAN         NOT NULL DEFAULT true,
    is_cpf_liable   BOOLEAN         NOT NULL DEFAULT true,
    effective_date  DATE            NOT NULL,
    end_date        DATE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE payroll_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id       UUID            NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    period          DATE            NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'draft',
    -- draft | pending_approval | approved | paid | void
    run_by          UUID            REFERENCES users(id),
    approved_by     UUID            REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    total_gross     NUMERIC(14,2)   DEFAULT 0,
    total_cpf_ee    NUMERIC(14,2)   DEFAULT 0,
    total_cpf_er    NUMERIC(14,2)   DEFAULT 0,
    total_shg       NUMERIC(14,2)   DEFAULT 0,
    total_sdl       NUMERIC(14,2)   DEFAULT 0,
    total_fwl       NUMERIC(14,2)   DEFAULT 0,
    total_net       NUMERIC(14,2)   DEFAULT 0,
    -- AI audit
    ai_audit_run    BOOLEAN         NOT NULL DEFAULT false,
    ai_flags_count  INTEGER         NOT NULL DEFAULT 0,
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (entity_id, period)
);

-- -------------------------------------------------------

CREATE TABLE payroll_records (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id          UUID            NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employment_id           UUID            NOT NULL REFERENCES employments(id),
    entity_id               UUID            NOT NULL REFERENCES entities(id),
    period                  DATE            NOT NULL,
    basic_salary            NUMERIC(12,2)   NOT NULL DEFAULT 0,
    fixed_allowances        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    overtime_pay            NUMERIC(12,2)   NOT NULL DEFAULT 0,
    bonus                   NUMERIC(12,2)   NOT NULL DEFAULT 0,
    commission              NUMERIC(12,2)   NOT NULL DEFAULT 0,
    gross_salary            NUMERIC(12,2)   NOT NULL DEFAULT 0,
    ordinary_wage           NUMERIC(12,2)   NOT NULL DEFAULT 0,
    additional_wage         NUMERIC(12,2)   NOT NULL DEFAULT 0,
    cpf_employee            NUMERIC(12,2)   NOT NULL DEFAULT 0,
    cpf_employer            NUMERIC(12,2)   NOT NULL DEFAULT 0,
    shg_deduction           NUMERIC(12,2)   NOT NULL DEFAULT 0,
    sdl_contribution        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    fwl_amount              NUMERIC(12,2)   NOT NULL DEFAULT 0,
    unpaid_leave_deduction  NUMERIC(12,2)   NOT NULL DEFAULT 0,
    claims_reimbursement    NUMERIC(12,2)   NOT NULL DEFAULT 0,
    other_deductions        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    net_salary              NUMERIC(12,2)   NOT NULL DEFAULT 0,
    status                  VARCHAR(20)     NOT NULL DEFAULT 'draft',
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (employment_id, period)
);

-- -------------------------------------------------------

CREATE TABLE payroll_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_record_id   UUID            NOT NULL REFERENCES payroll_records(id) ON DELETE CASCADE,
    item_type           VARCHAR(50)     NOT NULL,
    -- earning | deduction | allowance | bonus | overtime | reimbursement
    description         VARCHAR(255)    NOT NULL,
    quantity            NUMERIC(8,2),
    unit_rate           NUMERIC(12,4),
    amount              NUMERIC(12,2)   NOT NULL,
    is_taxable          BOOLEAN         NOT NULL DEFAULT true,
    is_cpf_liable       BOOLEAN         NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- LAYER 5: CPF
-- ============================================================

CREATE TABLE cpf_rate_config (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citizenship_type    VARCHAR(20)     NOT NULL,
    -- citizen | pr_yr1 | pr_yr2 | pr_yr3
    -- Foreigners (ep|s_pass|wp|dp|ltvp) are NOT in this table → 0% rate
    age_from            SMALLINT        NOT NULL,
    age_to              SMALLINT        NOT NULL,   -- 999 = no upper limit
    employee_rate       NUMERIC(6,5)    NOT NULL,
    employer_rate       NUMERIC(6,5)    NOT NULL,
    ow_ceiling          NUMERIC(10,2)   NOT NULL DEFAULT 6800.00,
    aw_ceiling_annual   NUMERIC(10,2)   NOT NULL DEFAULT 102000.00,
    effective_date      DATE            NOT NULL,
    end_date            DATE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cpf_rate_config IS
    'CPF rates — never hardcode in application code.
     Always lookup by citizenship_type + age + effective_date.
     Update every January when CPF Board announces new rates.
     Multi-employment: each entity applies ceiling INDEPENDENTLY.';

-- Seed 2024 CPF rates
INSERT INTO cpf_rate_config (citizenship_type, age_from, age_to, employee_rate, employer_rate, effective_date) VALUES
-- Singapore Citizens
('citizen',  0,  55, 0.20000, 0.17000, '2024-01-01'),
('citizen', 56,  60, 0.13000, 0.15000, '2024-01-01'),
('citizen', 61,  65, 0.07500, 0.11500, '2024-01-01'),
('citizen', 66,  70, 0.05000, 0.09000, '2024-01-01'),
('citizen', 71, 999, 0.05000, 0.07500, '2024-01-01'),
-- PR Year 1 (graduated — lower rates)
('pr_yr1',   0,  55, 0.05000, 0.04000, '2024-01-01'),
('pr_yr1',  56,  60, 0.05000, 0.04000, '2024-01-01'),
('pr_yr1',  61, 999, 0.05000, 0.04000, '2024-01-01'),
-- PR Year 2
('pr_yr2',   0,  55, 0.15000, 0.09000, '2024-01-01'),
('pr_yr2',  56,  60, 0.12500, 0.09000, '2024-01-01'),
('pr_yr2',  61, 999, 0.07500, 0.07500, '2024-01-01'),
-- PR Year 3 = same as citizen
('pr_yr3',   0,  55, 0.20000, 0.17000, '2024-01-01'),
('pr_yr3',  56,  60, 0.13000, 0.15000, '2024-01-01'),
('pr_yr3',  61,  65, 0.07500, 0.11500, '2024-01-01'),
('pr_yr3',  66,  70, 0.05000, 0.09000, '2024-01-01'),
('pr_yr3',  71, 999, 0.05000, 0.07500, '2024-01-01');

-- -------------------------------------------------------

CREATE TABLE cpf_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id           UUID            NOT NULL REFERENCES entities(id),
    period              DATE            NOT NULL,
    due_date            DATE            NOT NULL,   -- 14th of following month
    submission_date     TIMESTAMPTZ,
    status              VARCHAR(20)     NOT NULL DEFAULT 'pending',
    -- pending | generated | submitted | accepted | rejected
    cpf91_file_url      VARCHAR(500),
    total_employee_cpf  NUMERIC(14,2)   DEFAULT 0,
    total_employer_cpf  NUMERIC(14,2)   DEFAULT 0,
    total_sdl           NUMERIC(14,2)   DEFAULT 0,
    total_amount        NUMERIC(14,2)   DEFAULT 0,
    iras_ref            VARCHAR(50),
    notes               TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (entity_id, period)
);

-- -------------------------------------------------------

CREATE TABLE cpf_submission_lines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID            NOT NULL REFERENCES cpf_submissions(id) ON DELETE CASCADE,
    employment_id   UUID            NOT NULL REFERENCES employments(id),
    ordinary_wage   NUMERIC(12,2)   NOT NULL DEFAULT 0,
    additional_wage NUMERIC(12,2)   NOT NULL DEFAULT 0,
    cpf_employee    NUMERIC(12,2)   NOT NULL DEFAULT 0,
    cpf_employer    NUMERIC(12,2)   NOT NULL DEFAULT 0,
    sdl_amount      NUMERIC(12,2)   NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE person_cpf_summary (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id       UUID            NOT NULL REFERENCES persons(id),
    period          DATE            NOT NULL,
    total_ow        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    total_aw        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    note            TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (person_id, period)
);

COMMENT ON TABLE person_cpf_summary IS
    'Cross-entity OW/AW tracking per person per month.
     Used to verify AW ceiling ($102,000/year) is not exceeded
     across multiple simultaneous employments.
     Each entity still applies OW ceiling INDEPENDENTLY.';


-- ============================================================
-- LAYER 6: SHG / SDL / FWL
-- ============================================================

CREATE TABLE shg_rate_config (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shg_type            VARCHAR(20)     NOT NULL,
    -- CDAC | Mendaki | SINDA | ECF
    -- Mapping: Chinese→CDAC, Malay→Mendaki, Indian/Sri Lankan→SINDA, Eurasian→ECF
    wage_from           NUMERIC(10,2)   NOT NULL,
    wage_to             NUMERIC(10,2),
    deduction_amount    NUMERIC(8,2)    NOT NULL,
    effective_date      DATE            NOT NULL,
    end_date            DATE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE shg_rate_config IS
    'Self-Help Group deductions. Citizens and PRs only.
     EP/S-Pass/WP are EXEMPT.
     Lookup by gross_salary range per employment (not aggregated cross-entity).';

-- Seed 2024 SHG rates
INSERT INTO shg_rate_config (shg_type, wage_from, wage_to, deduction_amount, effective_date) VALUES
('CDAC',    0,       500,    0.50,  '2024-01-01'),
('CDAC',    500,     1000,   1.00,  '2024-01-01'),
('CDAC',    1000,    1500,   1.50,  '2024-01-01'),
('CDAC',    1500,    2000,   2.00,  '2024-01-01'),
('CDAC',    2000,    2500,   2.50,  '2024-01-01'),
('CDAC',    2500,    3000,   3.00,  '2024-01-01'),
('CDAC',    3000,    3500,   3.50,  '2024-01-01'),
('CDAC',    3500,    4000,   4.00,  '2024-01-01'),
('CDAC',    4000,    NULL,   4.00,  '2024-01-01'),
('Mendaki', 0,       1000,   0.50,  '2024-01-01'),
('Mendaki', 1000,    2000,   1.00,  '2024-01-01'),
('Mendaki', 2000,    3000,   2.00,  '2024-01-01'),
('Mendaki', 3000,    4000,   3.00,  '2024-01-01'),
('Mendaki', 4000,    NULL,   4.00,  '2024-01-01'),
('SINDA',   0,       1000,   0.50,  '2024-01-01'),
('SINDA',   1000,    2000,   1.50,  '2024-01-01'),
('SINDA',   2000,    3000,   3.00,  '2024-01-01'),
('SINDA',   3000,    NULL,   4.00,  '2024-01-01'),
('ECF',     0,       NULL,   2.00,  '2024-01-01');

-- -------------------------------------------------------

CREATE TABLE sdl_rate_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate            NUMERIC(6,5)    NOT NULL DEFAULT 0.00250,
    min_amount      NUMERIC(8,2)    NOT NULL DEFAULT 2.00,
    max_amount      NUMERIC(8,2)    NOT NULL DEFAULT 11.25,
    effective_date  DATE            NOT NULL,
    end_date        DATE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sdl_rate_config IS
    'SDL = 0.25% of gross, min $2.00, max $11.25.
     Applies to ALL employees including foreigners (EP/S-Pass/WP).
     Paid by employer, not deducted from employee.';

INSERT INTO sdl_rate_config (rate, min_amount, max_amount, effective_date)
VALUES (0.00250, 2.00, 11.25, '2024-01-01');

-- -------------------------------------------------------

CREATE TABLE fwl_rate_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pass_type       VARCHAR(20)     NOT NULL,   -- S_Pass | WP
    sector          VARCHAR(50),                -- services | construction | marine | process
    quota_tier      VARCHAR(20),                -- tier_1 | tier_2
    monthly_levy    NUMERIC(10,2)   NOT NULL,
    effective_date  DATE            NOT NULL,
    end_date        DATE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fwl_rate_config IS
    'Foreign Worker Levy — S-Pass and WP holders only.
     Paid by employer. Rate depends on pass type + sector + quota tier.
     Update when MOM changes FWL rates.';


-- ============================================================
-- LAYER 7: LEAVE
-- +1 new table: leave_cross_entity_checks
-- ============================================================

CREATE TABLE leave_types (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id           UUID            NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name                VARCHAR(100)    NOT NULL,
    code                VARCHAR(20)     NOT NULL,
    -- AL | ML | HL | CL | MAT | PAT | SML | UPL | OL
    is_paid             BOOLEAN         NOT NULL DEFAULT true,
    is_mom_mandated     BOOLEAN         NOT NULL DEFAULT false,
    max_days_per_year   NUMERIC(5,1),
    carry_forward       BOOLEAN         NOT NULL DEFAULT false,
    max_carry_days      NUMERIC(5,1)    DEFAULT 0,
    requires_mc         BOOLEAN         NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE leave_types IS
    'Leave types per entity. Each entity configures its own.
     MOM-mandated types: Annual, Medical, Hospitalisation,
     Maternity (16wks), Paternity (2wks), Childcare, Sick.';

-- -------------------------------------------------------

CREATE TABLE public_holidays (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holiday_date    DATE            NOT NULL UNIQUE,
    name            VARCHAR(100)    NOT NULL,
    year            SMALLINT        NOT NULL,
    is_gazetted     BOOLEAN         NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Seed Singapore Public Holidays 2024 & 2025 & 2026
INSERT INTO public_holidays (holiday_date, name, year) VALUES
('2024-01-01', 'New Year''s Day', 2024),
('2024-02-10', 'Chinese New Year', 2024),
('2024-02-11', 'Chinese New Year (2nd Day)', 2024),
('2024-03-29', 'Good Friday', 2024),
('2024-05-01', 'Labour Day', 2024),
('2024-05-22', 'Vesak Day', 2024),
('2024-06-17', 'Hari Raya Haji', 2024),
('2024-08-09', 'National Day', 2024),
('2024-10-31', 'Deepavali', 2024),
('2024-12-25', 'Christmas Day', 2024),
('2025-01-01', 'New Year''s Day', 2025),
('2025-01-29', 'Chinese New Year', 2025),
('2025-01-30', 'Chinese New Year (2nd Day)', 2025),
('2025-03-31', 'Hari Raya Puasa', 2025),
('2025-04-18', 'Good Friday', 2025),
('2025-05-01', 'Labour Day', 2025),
('2025-05-12', 'Vesak Day', 2025),
('2025-06-06', 'Hari Raya Haji', 2025),
('2025-08-09', 'National Day', 2025),
('2025-10-20', 'Deepavali', 2025),
('2025-12-25', 'Christmas Day', 2025),
('2026-01-01', 'New Year''s Day', 2026),
('2026-01-28', 'Chinese New Year', 2026),
('2026-01-29', 'Chinese New Year (2nd Day)', 2026),
('2026-03-20', 'Hari Raya Puasa', 2026),
('2026-04-03', 'Good Friday', 2026),
('2026-05-01', 'Labour Day', 2026),
('2026-05-31', 'Vesak Day', 2026),
('2026-05-27', 'Hari Raya Haji', 2026),
('2026-08-09', 'National Day', 2026),
('2026-11-08', 'Deepavali', 2026),
('2026-12-25', 'Christmas Day', 2026);

-- -------------------------------------------------------

CREATE TABLE leave_entitlements (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id       UUID            NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
    leave_type_id       UUID            NOT NULL REFERENCES leave_types(id),
    year                SMALLINT        NOT NULL,
    entitled_days       NUMERIC(5,1)    NOT NULL DEFAULT 0,
    used_days           NUMERIC(5,1)    NOT NULL DEFAULT 0,
    carried_forward     NUMERIC(5,1)    NOT NULL DEFAULT 0,
    balance_days        NUMERIC(5,1)    GENERATED ALWAYS AS
                            (entitled_days + carried_forward - used_days) STORED,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (employment_id, leave_type_id, year)
);

COMMENT ON TABLE leave_entitlements IS
    'Leave balance per employment per year.
     CRITICAL: Links to employment_id NOT person_id.
     Multi-employment persons get SEPARATE balances per entity.
     Proration: entitled_days = (full_entitlement / 12) * months_remaining
                rounded to nearest 0.5 day.';

-- -------------------------------------------------------

CREATE TABLE leave_applications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id       UUID            NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
    leave_type_id       UUID            NOT NULL REFERENCES leave_types(id),
    start_date          DATE            NOT NULL,
    end_date            DATE            NOT NULL,
    days_taken          NUMERIC(5,1)    NOT NULL,
    reason              TEXT,
    mc_document_url     VARCHAR(500),
    status              VARCHAR(20)     NOT NULL DEFAULT 'pending',
    -- pending | approved | rejected | cancelled
    approved_by         UUID            REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    -- AI analysis result
    ai_conflict_checked BOOLEAN         NOT NULL DEFAULT false,
    ai_conflict_result  JSONB,          -- { risk_level, message, cross_entity_overlap }
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE leave_applications IS
    'One application per employment per leave request.
     Multi-entity workers must submit per entity separately.
     cross_entity_overlap tracked in leave_cross_entity_checks.';

-- -------------------------------------------------------
-- NEW TABLE: Cross-Entity Leave Overlap Checker
-- -------------------------------------------------------

CREATE TABLE leave_cross_entity_checks (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id               UUID            NOT NULL REFERENCES persons(id),
    primary_application_id  UUID            NOT NULL REFERENCES leave_applications(id),
    -- application being approved
    overlapping_application_id UUID         REFERENCES leave_applications(id),
    -- conflicting application (may be NULL if no overlap found)
    check_date              DATE            NOT NULL,
    overlap_start           DATE,
    overlap_end             DATE,
    overlap_days            NUMERIC(5,1)    NOT NULL DEFAULT 0,
    primary_entity_id       UUID            NOT NULL REFERENCES entities(id),
    overlap_entity_id       UUID            REFERENCES entities(id),
    resolution              VARCHAR(50)     NOT NULL DEFAULT 'allowed',
    -- allowed | warned | blocked
    resolution_note         TEXT,
    checked_by              UUID            REFERENCES users(id),
    checked_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE leave_cross_entity_checks IS
    'Logs cross-entity leave overlap checks for multi-employment persons.
     RULE: Never hard-block overlaps (both entities may validly grant same day off).
     Always log and warn HR. HR manually resolves.
     Example valid overlap: PH falls on working day in Entity A but rest day in B —
     both must grant substitute leave independently.';


-- ============================================================
-- LAYER 8: CLAIMS & EXPENSES
-- ============================================================

CREATE TABLE claim_types (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id           UUID            NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name                VARCHAR(100)    NOT NULL,
    is_taxable          BOOLEAN         NOT NULL DEFAULT false,
    max_amount          NUMERIC(10,2),
    requires_receipt    BOOLEAN         NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE claim_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id   UUID            NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
    claim_type_id   UUID            NOT NULL REFERENCES claim_types(id),
    claim_date      DATE            NOT NULL,
    amount          NUMERIC(10,2)   NOT NULL,
    description     TEXT,
    receipt_url     VARCHAR(500),
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending',
    approved_by     UUID            REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    paid_in_period  DATE,
    rejection_reason TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- LAYER 9: IRAS / TAX
-- ============================================================

CREATE TABLE ir8a_records (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id       UUID            NOT NULL REFERENCES employments(id),
    entity_id           UUID            NOT NULL REFERENCES entities(id),
    year_of_assessment  SMALLINT        NOT NULL,
    gross_salary        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    bonus               NUMERIC(12,2)   NOT NULL DEFAULT 0,
    director_fee        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    commission          NUMERIC(12,2)   NOT NULL DEFAULT 0,
    allowances          NUMERIC(12,2)   NOT NULL DEFAULT 0,
    gratuity            NUMERIC(12,2)   NOT NULL DEFAULT 0,
    retirement_benefit  NUMERIC(12,2)   NOT NULL DEFAULT 0,
    cpf_employee        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    employee_cpf_relief NUMERIC(12,2)   NOT NULL DEFAULT 0,
    total_income        NUMERIC(12,2)   NOT NULL DEFAULT 0,
    submission_status   VARCHAR(20)     NOT NULL DEFAULT 'draft',
    -- draft | submitted | accepted | amended
    iras_ref            VARCHAR(50),
    submitted_at        TIMESTAMPTZ,
    -- AI pre-check
    ai_precheck_done    BOOLEAN         NOT NULL DEFAULT false,
    ai_precheck_flags   JSONB,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (employment_id, year_of_assessment)
);

-- -------------------------------------------------------

CREATE TABLE ir8a_appendix_8a (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ir8a_id         UUID            NOT NULL REFERENCES ir8a_records(id) ON DELETE CASCADE,
    benefit_type    VARCHAR(100)    NOT NULL,
    -- accommodation | company_car | club_membership | stock_options | insurance
    description     TEXT,
    annual_value    NUMERIC(12,2)   NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE ais_submissions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id           UUID            NOT NULL REFERENCES entities(id),
    year_of_assessment  SMALLINT        NOT NULL,
    record_count        INTEGER         NOT NULL DEFAULT 0,
    total_income        NUMERIC(14,2)   DEFAULT 0,
    submitted_at        TIMESTAMPTZ,
    iras_ref            VARCHAR(50),
    file_url            VARCHAR(500),
    status              VARCHAR(20)     NOT NULL DEFAULT 'draft',
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (entity_id, year_of_assessment)
);


-- ============================================================
-- LAYER 10: WORK PASS
-- ============================================================

CREATE TABLE work_passes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id   UUID            NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
    pass_type       VARCHAR(50)     NOT NULL,
    -- EP | S_Pass | WP | DP | LTVP | PEP
    pass_number     VARCHAR(50)     UNIQUE,
    issue_date      DATE,
    expiry_date     DATE            NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'active',
    -- active | expired | cancelled | renewed
    min_qualifying_salary NUMERIC(10,2),  -- MOM minimum for this pass type
    renewal_submitted_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE work_pass_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_pass_id    UUID            NOT NULL REFERENCES work_passes(id) ON DELETE CASCADE,
    alert_type      VARCHAR(20)     NOT NULL,
    -- 6_months | 3_months | 1_month | expired
    alert_date      DATE            NOT NULL,
    is_sent         BOOLEAN         NOT NULL DEFAULT false,
    sent_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (work_pass_id, alert_type)
);


-- ============================================================
-- LAYER 11: TIME & ATTENDANCE (10 TABLES)
-- ============================================================

CREATE TABLE shifts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id       UUID            NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    name            VARCHAR(100)    NOT NULL,
    start_time      TIME            NOT NULL,
    end_time        TIME            NOT NULL,
    break_minutes   SMALLINT        NOT NULL DEFAULT 60,
    work_hours      NUMERIC(4,2)    NOT NULL,
    is_overnight    BOOLEAN         NOT NULL DEFAULT false,
    grace_minutes   SMALLINT        NOT NULL DEFAULT 5,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE employment_shifts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id   UUID            NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
    shift_id        UUID            NOT NULL REFERENCES shifts(id),
    effective_date  DATE            NOT NULL,
    end_date        DATE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE work_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id   UUID            NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
    monday          BOOLEAN         NOT NULL DEFAULT true,
    tuesday         BOOLEAN         NOT NULL DEFAULT true,
    wednesday       BOOLEAN         NOT NULL DEFAULT true,
    thursday        BOOLEAN         NOT NULL DEFAULT true,
    friday          BOOLEAN         NOT NULL DEFAULT true,
    saturday        BOOLEAN         NOT NULL DEFAULT false,
    sunday          BOOLEAN         NOT NULL DEFAULT false,
    weekly_hours    NUMERIC(4,2)    NOT NULL DEFAULT 44.0,
    effective_date  DATE            NOT NULL,
    end_date        DATE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE shift_roster (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id   UUID            NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
    entity_id       UUID            NOT NULL REFERENCES entities(id),
    roster_date     DATE            NOT NULL,
    shift_id        UUID            REFERENCES shifts(id),
    day_type        VARCHAR(20)     NOT NULL DEFAULT 'normal',
    -- normal | rest_day | off_day | public_holiday
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (employment_id, roster_date)
);

-- -------------------------------------------------------

CREATE TABLE attendance_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id   UUID            NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
    entity_id       UUID            NOT NULL REFERENCES entities(id),
    work_date       DATE            NOT NULL,
    clock_in        TIMESTAMPTZ,
    clock_out       TIMESTAMPTZ,
    source          VARCHAR(20)     NOT NULL DEFAULT 'manual',
    -- biometric | mobile_app | web_portal | qr_code | manual | api
    location_lat    NUMERIC(10,7),
    location_lng    NUMERIC(10,7),
    is_approved     BOOLEAN         NOT NULL DEFAULT false,
    approved_by     UUID            REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    notes           TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (employment_id, work_date)
);

-- -------------------------------------------------------

CREATE TABLE daily_attendance (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_record_id    UUID            NOT NULL REFERENCES attendance_records(id) ON DELETE CASCADE,
    employment_id           UUID            NOT NULL REFERENCES employments(id),
    work_date               DATE            NOT NULL,
    day_type                VARCHAR(20)     NOT NULL DEFAULT 'normal',
    -- normal | rest_day | public_holiday | off_day
    scheduled_hours         NUMERIC(5,2)    NOT NULL DEFAULT 0,
    actual_hours            NUMERIC(5,2)    NOT NULL DEFAULT 0,
    normal_hours            NUMERIC(5,2)    NOT NULL DEFAULT 0,
    ot_hours_1_5x           NUMERIC(5,2)    NOT NULL DEFAULT 0,
    ot_hours_2x             NUMERIC(5,2)    NOT NULL DEFAULT 0,
    late_minutes            SMALLINT        NOT NULL DEFAULT 0,
    early_leave_minutes     SMALLINT        NOT NULL DEFAULT 0,
    is_absent               BOOLEAN         NOT NULL DEFAULT false,
    is_late                 BOOLEAN         NOT NULL DEFAULT false,
    status                  VARCHAR(20)     NOT NULL DEFAULT 'pending',
    processed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (employment_id, work_date)
);

-- -------------------------------------------------------

CREATE TABLE monthly_ot_summary (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id           UUID            NOT NULL REFERENCES employments(id),
    entity_id               UUID            NOT NULL REFERENCES entities(id),
    period                  DATE            NOT NULL,
    total_working_days      SMALLINT        NOT NULL DEFAULT 0,
    total_present_days      SMALLINT        NOT NULL DEFAULT 0,
    total_absent_days       SMALLINT        NOT NULL DEFAULT 0,
    total_late_days         SMALLINT        NOT NULL DEFAULT 0,
    total_normal_hours      NUMERIC(7,2)    NOT NULL DEFAULT 0,
    total_ot_hours          NUMERIC(7,2)    NOT NULL DEFAULT 0,
    ot_hours_1_5x           NUMERIC(7,2)    NOT NULL DEFAULT 0,
    ot_hours_2x             NUMERIC(7,2)    NOT NULL DEFAULT 0,
    hourly_rate             NUMERIC(10,4)   NOT NULL DEFAULT 0,  -- basic / 209
    ot_pay_1_5x             NUMERIC(12,2)   NOT NULL DEFAULT 0,
    ot_pay_2x               NUMERIC(12,2)   NOT NULL DEFAULT 0,
    total_ot_pay            NUMERIC(12,2)   NOT NULL DEFAULT 0,
    exceeds_72hr_limit      BOOLEAN         NOT NULL DEFAULT false,
    is_finalized            BOOLEAN         NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (employment_id, period)
);

-- -------------------------------------------------------

CREATE TABLE ot_requests (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id       UUID            NOT NULL REFERENCES employments(id) ON DELETE CASCADE,
    entity_id           UUID            NOT NULL REFERENCES entities(id),
    request_date        DATE            NOT NULL,
    ot_start            TIMESTAMPTZ     NOT NULL,
    ot_end              TIMESTAMPTZ     NOT NULL,
    estimated_hours     NUMERIC(5,2),
    actual_hours        NUMERIC(5,2),
    reason              TEXT            NOT NULL,
    status              VARCHAR(20)     NOT NULL DEFAULT 'pending',
    approved_by         UUID            REFERENCES users(id),
    approved_at         TIMESTAMPTZ,
    rejection_reason    TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE ot_settings (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id               UUID            NOT NULL REFERENCES employments(id) ON DELETE CASCADE UNIQUE,
    is_ot_eligible              BOOLEAN         NOT NULL DEFAULT true,
    covered_by_part_iv          BOOLEAN         NOT NULL DEFAULT true,
    ot_rate_type                VARCHAR(20)     NOT NULL DEFAULT 'statutory',
    contractual_ot_rate         NUMERIC(5,2),
    monthly_ot_cap_hours        SMALLINT        NOT NULL DEFAULT 72,
    normal_day_threshold_hrs    NUMERIC(4,2)    NOT NULL DEFAULT 8.0,
    created_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE attendance_amendments (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_record_id    UUID            NOT NULL REFERENCES attendance_records(id),
    amended_by              UUID            NOT NULL REFERENCES users(id),
    original_clock_in       TIMESTAMPTZ,
    original_clock_out      TIMESTAMPTZ,
    new_clock_in            TIMESTAMPTZ,
    new_clock_out           TIMESTAMPTZ,
    reason                  TEXT            NOT NULL,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- LAYER 12: BILLING & SUBSCRIPTION
-- ============================================================

CREATE TABLE subscriptions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID            NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    plan                    VARCHAR(50)     NOT NULL DEFAULT 'starter',
    -- starter ($29/mo base + $2/employee)
    -- growth  ($79/mo base + $1.50/employee)
    -- business ($149/mo base + $1.00/employee)
    -- enterprise (custom)
    billing_cycle           VARCHAR(20)     NOT NULL DEFAULT 'monthly',
    status                  VARCHAR(20)     NOT NULL DEFAULT 'trialing',
    -- trialing | active | past_due | suspended | cancelled
    stripe_customer_id      VARCHAR(100),
    stripe_sub_id           VARCHAR(100),
    trial_end               DATE,
    current_period_start    DATE,
    current_period_end      DATE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID            NOT NULL REFERENCES tenants(id),
    period          DATE            NOT NULL,
    base_amount     NUMERIC(10,2)   NOT NULL DEFAULT 0,
    employee_fee    NUMERIC(10,2)   NOT NULL DEFAULT 0,
    subtotal        NUMERIC(10,2)   NOT NULL DEFAULT 0,
    gst_rate        NUMERIC(5,4)    NOT NULL DEFAULT 0.0900,   -- 9% Singapore GST
    gst_amount      NUMERIC(10,2)   NOT NULL DEFAULT 0,
    total_amount    NUMERIC(10,2)   NOT NULL DEFAULT 0,
    status          VARCHAR(20)     NOT NULL DEFAULT 'pending',
    stripe_inv_id   VARCHAR(100),
    paid_at         TIMESTAMPTZ,
    due_date        DATE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE billing_usage (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID            NOT NULL REFERENCES tenants(id),
    period              DATE            NOT NULL,
    total_entities      INTEGER         NOT NULL DEFAULT 0,
    total_employees     INTEGER         NOT NULL DEFAULT 0,
    plan_at_billing     VARCHAR(50),
    recorded_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, period)
);


-- ============================================================
-- LAYER 13: AUDIT & SYSTEM
-- ============================================================

CREATE TABLE audit_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID            REFERENCES tenants(id),
    user_id                 UUID            REFERENCES users(id),
    entity_id               UUID            REFERENCES entities(id),
    table_name              VARCHAR(100)    NOT NULL,
    record_id               UUID,
    action                  VARCHAR(20)     NOT NULL,   -- INSERT | UPDATE | DELETE
    old_value               JSONB,
    new_value               JSONB,
    ip_address              VARCHAR(45),
    user_agent              VARCHAR(500),
    impersonated_by         UUID            REFERENCES platform_admins(id),
    -- set when action performed during impersonation session
    impersonation_session_id UUID           REFERENCES impersonation_sessions(id),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_logs IS
    'Every write operation (INSERT/UPDATE/DELETE) across all tenant tables.
     impersonated_by set when support admin performed action via impersonation.
     Retain 7 years per IRAS / MOM requirements.
     Never delete — archive to S3 Glacier after 2 years.';

-- -------------------------------------------------------

CREATE TABLE notifications (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID            REFERENCES tenants(id),
    user_id     UUID            REFERENCES users(id),
    entity_id   UUID            REFERENCES entities(id),
    type        VARCHAR(50)     NOT NULL,
    -- work_pass_expiry | payroll_due | cpf_due | leave_approved
    -- ot_limit | ai_anomaly | ir8a_due | platform_announcement
    title       VARCHAR(255)    NOT NULL,
    message     TEXT,
    is_read     BOOLEAN         NOT NULL DEFAULT false,
    sent_via    VARCHAR(20),
    sent_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------

CREATE TABLE document_storage (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID            NOT NULL REFERENCES tenants(id),
    entity_id       UUID            REFERENCES entities(id),
    employment_id   UUID            REFERENCES employments(id),
    doc_type        VARCHAR(50)     NOT NULL,
    -- payslip | ir8a | cpf91 | ket | contract | mc | receipt | giro
    file_name       VARCHAR(255)    NOT NULL,
    file_url        VARCHAR(500)    NOT NULL,   -- S3 presigned path
    file_size       INTEGER,
    period          DATE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);


-- ============================================================
-- LAYER 14: AI FEATURES (3 NEW TABLES)
-- ============================================================

CREATE TABLE ai_audit_flags (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_run_id      UUID            NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
    employment_id       UUID            REFERENCES payroll_records(id),
    flag_type           VARCHAR(100)    NOT NULL,
    -- salary_spike | cpf_drop | bank_match | ot_near_cap
    -- duplicate_employee | zero_salary | missing_cpf | shg_mismatch
    severity            VARCHAR(10)     NOT NULL DEFAULT 'medium',
    -- high | medium | low
    description         TEXT            NOT NULL,   -- plain English for HR
    ai_reasoning        TEXT,                       -- Claude's explanation
    suggested_action    TEXT,
    is_dismissed        BOOLEAN         NOT NULL DEFAULT false,
    dismissed_by        UUID            REFERENCES users(id),
    dismissed_at        TIMESTAMPTZ,
    dismissed_reason    TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_audit_flags IS
    'AI payroll anomaly detector results.
     Shown inline in payroll approval screen.
     HR must dismiss each flag before payroll can be approved
     (configurable: require_all_dismissed flag per entity).';

-- -------------------------------------------------------

CREATE TABLE ai_chat_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID            NOT NULL REFERENCES tenants(id),
    entity_id       UUID            REFERENCES entities(id),
    user_id         UUID            NOT NULL REFERENCES users(id),
    session_type    VARCHAR(50)     NOT NULL,
    -- mom_copilot | payslip_explainer | nl_report | hr_letter
    title           VARCHAR(255),
    messages        JSONB           NOT NULL DEFAULT '[]',
    -- [{ role: user|assistant, content: "...", ts: "..." }]
    context_data    JSONB,
    -- snapshot of employee/payroll data used in this session
    model_used      VARCHAR(100)    NOT NULL DEFAULT 'claude-sonnet-4-20250514',
    tokens_used     INTEGER         NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ai_chat_sessions IS
    'Persistent conversation history for AI features.
     MOM Copilot, Payslip Explainer, NL Reports, HR Letter Generator.
     context_data snapshotted at session start — not live data.
     tokens_used tracked for billing/quota management.';

-- -------------------------------------------------------

CREATE TABLE ai_attrition_scores (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employment_id       UUID            NOT NULL REFERENCES employments(id),
    entity_id           UUID            NOT NULL REFERENCES entities(id),
    score_date          DATE            NOT NULL,   -- first of each month
    risk_score          NUMERIC(5,2)    NOT NULL,   -- 0.00 to 100.00
    risk_level          VARCHAR(10)     NOT NULL,   -- low | medium | high | critical
    contributing_factors JSONB          NOT NULL DEFAULT '[]',
    -- [{ factor: "mc_spike", weight: 0.3, detail: "..." }]
    -- Factors: mc_spike | ot_drop | salary_stagnant | peer_raises
    --          late_pattern | leave_fragmented | tenure_milestone
    recommended_action  TEXT,
    is_actioned         BOOLEAN         NOT NULL DEFAULT false,
    actioned_by         UUID            REFERENCES users(id),
    actioned_at         TIMESTAMPTZ,
    actioned_note       TEXT,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (employment_id, score_date)
);

COMMENT ON TABLE ai_attrition_scores IS
    'Monthly AI flight-risk scores per employment.
     Computed by Celery task on 1st of each month.
     Signals: MC frequency, OT engagement, salary vs peer group,
     attendance patterns, time since last increment.';


-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- Platform Admin
CREATE INDEX idx_platform_audit_admin     ON platform_audit_logs(admin_id, created_at);
CREATE INDEX idx_platform_audit_tenant    ON platform_audit_logs(impersonating_tenant_id, created_at);
CREATE INDEX idx_impersonation_admin      ON impersonation_sessions(platform_admin_id);
CREATE INDEX idx_impersonation_tenant     ON impersonation_sessions(tenant_id);
CREATE INDEX idx_feature_flags_key        ON feature_flags(flag_key);
CREATE INDEX idx_announcements_active     ON platform_announcements(show_from, show_until);

-- Tenant & Entity
CREATE INDEX idx_entities_tenant          ON entities(tenant_id);
CREATE INDEX idx_tenants_active           ON tenants(is_active, subscription_plan);

-- Users & Access
CREATE INDEX idx_users_tenant             ON users(tenant_id);
CREATE INDEX idx_user_entity_access_user  ON user_entity_access(user_id);
CREATE INDEX idx_user_entity_access_entity ON user_entity_access(entity_id);
CREATE INDEX idx_user_entity_access_role  ON user_entity_access(entity_id, role);

-- People & Employment
CREATE INDEX idx_persons_tenant_nric      ON persons(tenant_id, nric_fin);
CREATE INDEX idx_persons_name_trgm        ON persons USING gin(full_name gin_trgm_ops);
CREATE INDEX idx_employments_person       ON employments(person_id);
CREATE INDEX idx_employments_entity       ON employments(entity_id);
CREATE INDEX idx_employments_active       ON employments(entity_id, is_active);
CREATE INDEX idx_employments_cship        ON employments(entity_id, citizenship_type);

-- Payroll
CREATE INDEX idx_payroll_runs_entity      ON payroll_runs(entity_id, period);
CREATE INDEX idx_payroll_runs_status      ON payroll_runs(status, entity_id);
CREATE INDEX idx_payroll_records_run      ON payroll_records(payroll_run_id);
CREATE INDEX idx_payroll_records_emp      ON payroll_records(employment_id, period);
CREATE INDEX idx_payroll_items_record     ON payroll_items(payroll_record_id);

-- CPF
CREATE INDEX idx_cpf_submissions_entity   ON cpf_submissions(entity_id, period);
CREATE INDEX idx_cpf_lines_submission     ON cpf_submission_lines(submission_id);
CREATE INDEX idx_person_cpf_summary       ON person_cpf_summary(person_id, period);

-- Leave
CREATE INDEX idx_leave_apps_employment    ON leave_applications(employment_id);
CREATE INDEX idx_leave_apps_status        ON leave_applications(status, employment_id);
CREATE INDEX idx_leave_apps_dates         ON leave_applications(start_date, end_date);
CREATE INDEX idx_leave_entitlements_emp   ON leave_entitlements(employment_id, year);
CREATE INDEX idx_cross_entity_person      ON leave_cross_entity_checks(person_id, check_date);
CREATE INDEX idx_cross_entity_primary     ON leave_cross_entity_checks(primary_application_id);

-- Work Pass
CREATE INDEX idx_work_passes_expiry       ON work_passes(expiry_date, status);
CREATE INDEX idx_work_pass_alerts_date    ON work_pass_alerts(alert_date, is_sent);

-- Attendance
CREATE INDEX idx_attendance_emp_date      ON attendance_records(employment_id, work_date);
CREATE INDEX idx_attendance_entity_date   ON attendance_records(entity_id, work_date);
CREATE INDEX idx_daily_att_emp_date       ON daily_attendance(employment_id, work_date);
CREATE INDEX idx_monthly_ot_emp_period    ON monthly_ot_summary(employment_id, period);
CREATE INDEX idx_shift_roster_emp_date    ON shift_roster(employment_id, roster_date);
CREATE INDEX idx_ot_requests_emp          ON ot_requests(employment_id, request_date);

-- Audit
CREATE INDEX idx_audit_logs_tenant        ON audit_logs(tenant_id, created_at);
CREATE INDEX idx_audit_logs_table         ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_impersonation ON audit_logs(impersonated_by, created_at)
    WHERE impersonated_by IS NOT NULL;
CREATE INDEX idx_notifications_user       ON notifications(user_id, is_read);

-- Document storage
CREATE INDEX idx_doc_storage_employment   ON document_storage(employment_id, doc_type);
CREATE INDEX idx_doc_storage_period       ON document_storage(entity_id, period, doc_type);

-- AI
CREATE INDEX idx_ai_flags_run             ON ai_audit_flags(payroll_run_id, is_dismissed);
CREATE INDEX idx_ai_flags_severity        ON ai_audit_flags(severity, is_dismissed);
CREATE INDEX idx_ai_chat_user             ON ai_chat_sessions(user_id, created_at);
CREATE INDEX idx_ai_attrition_entity      ON ai_attrition_scores(entity_id, score_date);
CREATE INDEX idx_ai_attrition_risk        ON ai_attrition_scores(entity_id, risk_level, score_date);


-- ============================================================
-- TABLE COUNT SUMMARY (52 TABLES)
-- ============================================================
-- Layer 0  Platform Admin          : platform_admins, platform_audit_logs,
--                                    platform_announcements, feature_flags,
--                                    impersonation_sessions               (5)
-- Layer 1  Tenant & Entity         : tenants, entities                    (2)
-- Layer 2  User & Access           : users, user_entity_access            (2)
-- Layer 3  People & Employment     : persons, departments, bank_accounts,
--                                    employments, employee_entity_history  (5)
-- Layer 4  Payroll                 : salary_structures, payroll_runs,
--                                    payroll_records, payroll_items        (4)
-- Layer 5  CPF                     : cpf_rate_config, cpf_submissions,
--                                    cpf_submission_lines, person_cpf_summary (4)
-- Layer 6  SHG / SDL / FWL         : shg_rate_config, sdl_rate_config,
--                                    fwl_rate_config                      (3)
-- Layer 7  Leave                   : leave_types, public_holidays,
--                                    leave_entitlements, leave_applications,
--                                    leave_cross_entity_checks            (5)
-- Layer 8  Claims                  : claim_types, claim_applications      (2)
-- Layer 9  IRAS / Tax              : ir8a_records, ir8a_appendix_8a,
--                                    ais_submissions                      (3)
-- Layer 10 Work Pass               : work_passes, work_pass_alerts        (2)
-- Layer 11 Time & Attendance       : shifts, employment_shifts,
--                                    work_schedules, shift_roster,
--                                    attendance_records, daily_attendance,
--                                    monthly_ot_summary, ot_requests,
--                                    ot_settings, attendance_amendments  (10)
-- Layer 12 Billing                 : subscriptions, invoices,
--                                    billing_usage                        (3)
-- Layer 13 Audit & System          : audit_logs, notifications,
--                                    document_storage                     (3)
-- Layer 14 AI Features             : ai_audit_flags, ai_chat_sessions,
--                                    ai_attrition_scores                  (3)
-- ============================================================
-- TOTAL: 52 TABLES
-- ============================================================
