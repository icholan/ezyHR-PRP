"""baseline: create all 41 tables

Revision ID: 0000
Revises:
Create Date: 2026-03-03

This is the baseline migration that creates ALL application tables from
scratch. It enables fresh deployments (e.g. Railway) to bootstrap the
entire database schema via `alembic upgrade head`.

On existing databases that already have tables, stamp past this migration:
    alembic stamp 0000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '0000'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Standalone tables (no FK dependencies) ──────────────────────────

    op.create_table('cpf_rate_config',
        sa.Column('citizenship_type', sa.String(20), nullable=False),
        sa.Column('age_from', sa.Integer(), nullable=False),
        sa.Column('age_to', sa.Integer(), nullable=False),
        sa.Column('employee_rate', sa.Numeric(precision=6, scale=5), nullable=False),
        sa.Column('employer_rate', sa.Numeric(precision=6, scale=5), nullable=False),
        sa.Column('ow_ceiling', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('aw_ceiling_annual', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    op.create_table('platform_admins',
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('mfa_secret', sa.String(255)),
        sa.Column('mfa_enabled', sa.Boolean(), nullable=False),
        sa.Column('mfa_backup_codes', postgresql.ARRAY(sa.Text())),
        sa.Column('last_login_at', sa.DateTime(timezone=True)),
        sa.Column('last_login_ip', postgresql.INET()),
        sa.Column('password_changed_at', sa.DateTime(timezone=True)),
        sa.Column('created_by', postgresql.UUID(as_uuid=True)),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['created_by'], ['platform_admins.id']),
        sa.UniqueConstraint('email'),
    )

    op.create_table('sdl_rate_config',
        sa.Column('rate', sa.Numeric(precision=6, scale=5), nullable=False),
        sa.Column('min_amount', sa.Numeric(precision=8, scale=2), nullable=False),
        sa.Column('max_amount', sa.Numeric(precision=8, scale=2), nullable=False),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    op.create_table('shg_rate_config',
        sa.Column('shg_type', sa.String(20), nullable=False),
        sa.Column('wage_from', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('wage_to', sa.Numeric(precision=10, scale=2)),
        sa.Column('deduction_amount', sa.Numeric(precision=8, scale=2), nullable=False),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
    )

    # ── Tenant layer ────────────────────────────────────────────────────

    op.create_table('tenants',
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('subscription_plan', sa.String(50), nullable=False),
        sa.Column('billing_email', sa.String(255), nullable=False),
        sa.Column('contact_number', sa.String(20)),
        sa.Column('setup_complete', sa.Boolean(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('suspended_at', sa.DateTime(timezone=True)),
        sa.Column('suspended_reason', sa.Text()),
        sa.Column('suspended_by', postgresql.UUID(as_uuid=True)),
        sa.Column('trial_ends_at', sa.DateTime(timezone=True)),
        sa.Column('notes', sa.Text()),
        sa.Column('mrr', sa.Numeric(precision=10, scale=2)),
        sa.Column('assigned_csm', postgresql.UUID(as_uuid=True)),
        sa.Column('stripe_customer_id', sa.String(100)),
        sa.Column('data_deletion_requested_at', sa.DateTime(timezone=True)),
        sa.Column('data_deletion_completed_at', sa.DateTime(timezone=True)),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['suspended_by'], ['platform_admins.id']),
        sa.ForeignKeyConstraint(['assigned_csm'], ['platform_admins.id']),
    )

    op.create_table('entities',
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('uen', sa.String(20)),
        sa.Column('cpf_account_no', sa.String(20)),
        sa.Column('iras_tax_ref', sa.String(20)),
        sa.Column('registered_address', sa.Text()),
        sa.Column('gst_registered', sa.Boolean(), nullable=False),
        sa.Column('gst_no', sa.String(20)),
        sa.Column('industry_code', sa.String(10)),
        sa.Column('payroll_cutoff_day', sa.Integer(), nullable=False),
        sa.Column('payment_day', sa.Integer(), nullable=False),
        sa.Column('work_week_hours', sa.Numeric(precision=4, scale=2), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('uen'),
    )

    op.create_table('persons',
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('nric_fin', sa.String(255)),
        sa.Column('nationality', sa.String(50)),
        sa.Column('race', sa.String(50)),
        sa.Column('religion', sa.String(50)),
        sa.Column('date_of_birth', sa.Date()),
        sa.Column('gender', sa.String(10)),
        sa.Column('contact_number', sa.String(20)),
        sa.Column('mobile_number', sa.String(20)),
        sa.Column('whatsapp_number', sa.String(20)),
        sa.Column('personal_email', sa.String(255)),
        sa.Column('language', sa.String(50)),
        sa.Column('address', sa.Text()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('tenant_id', 'nric_fin', name='uq_persons_nric'),
    )

    op.create_table('roles',
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('description', sa.String(200)),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    )

    op.create_table('subscriptions',
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('plan', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('stripe_customer_id', sa.String(100)),
        sa.Column('current_period_end', sa.Date()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('tenant_id'),
    )

    op.create_table('system_audit_logs',
        sa.Column('admin_id', postgresql.UUID(as_uuid=True)),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True)),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('ip_address', sa.String(50)),
        sa.Column('details', postgresql.JSONB()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['admin_id'], ['platform_admins.id']),
    )

    # ── Users & Auth ────────────────────────────────────────────────────

    op.create_table('users',
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255)),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('is_tenant_admin', sa.Boolean(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('two_fa_enabled', sa.Boolean(), nullable=False),
        sa.Column('two_fa_secret', sa.String(255)),
        sa.Column('last_login', sa.DateTime(timezone=True)),
        sa.Column('last_login_ip', postgresql.INET()),
        sa.Column('password_reset_token', sa.String(255)),
        sa.Column('password_reset_expires', sa.DateTime(timezone=True)),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('email'),
    )

    op.create_table('role_permissions',
        sa.Column('role_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('permission', sa.String(50), primary_key=True),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
    )

    op.create_table('user_entity_access',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('managed_department_ids', postgresql.ARRAY(sa.UUID())),
        sa.Column('granted_by', postgresql.UUID(as_uuid=True)),
        sa.Column('granted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['granted_by'], ['users.id']),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    )

    op.create_table('notifications',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text()),
        sa.Column('is_read', sa.Boolean(), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
    )

    op.create_table('audit_logs',
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True)),
        sa.Column('user_id', postgresql.UUID(as_uuid=True)),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True)),
        sa.Column('table_name', sa.String(100), nullable=False),
        sa.Column('record_id', postgresql.UUID(as_uuid=True)),
        sa.Column('action', sa.String(20), nullable=False),
        sa.Column('old_value', postgresql.JSONB()),
        sa.Column('new_value', postgresql.JSONB()),
        sa.Column('impersonated_by', postgresql.UUID(as_uuid=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.ForeignKeyConstraint(['impersonated_by'], ['platform_admins.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id']),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
    )

    # ── People & Employment ─────────────────────────────────────────────

    op.create_table('bank_accounts',
        sa.Column('person_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('bank_name', sa.String(100), nullable=False),
        sa.Column('account_number', sa.String(255), nullable=False),
        sa.Column('account_name', sa.String(255), nullable=False),
        sa.Column('is_default', sa.Boolean(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['person_id'], ['persons.id'], ondelete='CASCADE'),
    )

    op.create_table('departments',
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(50)),
        sa.Column('description', sa.Text()),
        sa.Column('parent_id', postgresql.UUID(as_uuid=True)),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['parent_id'], ['departments.id']),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
    )

    op.create_table('grades',
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(50)),
        sa.Column('description', sa.Text()),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
    )

    op.create_table('groups',
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('code', sa.String(50)),
        sa.Column('description', sa.Text()),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
    )

    op.create_table('customers',
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('code', sa.String(50)),
        sa.Column('uen', sa.String(50)),
        sa.Column('billing_address', sa.Text()),
        sa.Column('contact_name', sa.String(255)),
        sa.Column('contact_email', sa.String(255)),
        sa.Column('contact_number', sa.String(20)),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
    )

    op.create_table('employments',
        sa.Column('person_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('employee_code', sa.String(50)),
        sa.Column('employment_type', sa.String(50), nullable=False),
        sa.Column('job_title', sa.String(100)),
        sa.Column('department_id', postgresql.UUID(as_uuid=True)),
        sa.Column('grade_id', postgresql.UUID(as_uuid=True)),
        sa.Column('group_id', postgresql.UUID(as_uuid=True)),
        sa.Column('citizenship_type', sa.String(20), nullable=False),
        sa.Column('pr_year', sa.Integer()),
        sa.Column('work_pass_type', sa.String(50)),
        sa.Column('work_pass_no', sa.String(50)),
        sa.Column('work_pass_expiry', sa.Date()),
        sa.Column('join_date', sa.Date(), nullable=False),
        sa.Column('resign_date', sa.Date()),
        sa.Column('probation_end_date', sa.Date()),
        sa.Column('basic_salary', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('payment_mode', sa.String(20), nullable=False),
        sa.Column('bank_account_id', postgresql.UUID(as_uuid=True)),
        sa.Column('is_ot_eligible', sa.Boolean(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['grade_id'], ['grades.id']),
        sa.ForeignKeyConstraint(['person_id'], ['persons.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id']),
        sa.ForeignKeyConstraint(['bank_account_id'], ['bank_accounts.id']),
        sa.UniqueConstraint('person_id', 'entity_id', 'join_date', name='uq_employments_period'),
    )

    # ── Payroll ─────────────────────────────────────────────────────────

    op.create_table('payroll_runs',
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('period', sa.Date(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('run_by', postgresql.UUID(as_uuid=True)),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True)),
        sa.Column('approved_at', sa.DateTime(timezone=True)),
        sa.Column('paid_at', sa.DateTime(timezone=True)),
        sa.Column('total_gross', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('total_cpf_ee', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('total_cpf_er', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('total_shg', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('total_sdl', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('total_fwl', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('total_net', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('total_employees', sa.Integer(), nullable=False),
        sa.Column('ai_audit_run', sa.Boolean(), nullable=False),
        sa.Column('ai_flags_count', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['run_by'], ['users.id']),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id']),
        sa.UniqueConstraint('entity_id', 'period', name='uq_payroll_runs_period'),
    )

    op.create_table('payroll_records',
        sa.Column('payroll_run_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('employment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('period', sa.Date(), nullable=False),
        sa.Column('basic_salary', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('fixed_allowances', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('overtime_pay', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('bonus', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('commission', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('gross_salary', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('ordinary_wage', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('additional_wage', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('cpf_employee', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('cpf_employer', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('shg_deduction', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('sdl_contribution', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('fwl_amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('unpaid_leave_deduction', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('claims_reimbursement', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('other_deductions', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('net_salary', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['payroll_run_id'], ['payroll_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id']),
        sa.ForeignKeyConstraint(['employment_id'], ['employments.id']),
        sa.UniqueConstraint('employment_id', 'period', name='uq_payroll_records_period'),
    )

    op.create_table('salary_structures',
        sa.Column('employment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('component', sa.String(100), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('is_taxable', sa.Boolean(), nullable=False),
        sa.Column('is_cpf_liable', sa.Boolean(), nullable=False),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['employment_id'], ['employments.id'], ondelete='CASCADE'),
    )

    op.create_table('audit_flags',
        sa.Column('payroll_run_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('payroll_record_id', postgresql.UUID(as_uuid=True)),
        sa.Column('flag_type', sa.String(50), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('severity', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('resolved_by', postgresql.UUID(as_uuid=True)),
        sa.Column('resolved_at', sa.DateTime(timezone=True)),
        sa.Column('resolution_notes', sa.Text()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['payroll_record_id'], ['payroll_records.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id']),
        sa.ForeignKeyConstraint(['payroll_run_id'], ['payroll_runs.id'], ondelete='CASCADE'),
    )

    op.create_table('claim_applications',
        sa.Column('employment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('claim_date', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True)),
        sa.Column('paid_in_period', sa.Date()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id']),
        sa.ForeignKeyConstraint(['employment_id'], ['employments.id'], ondelete='CASCADE'),
    )

    # ── Statutory / CPF ─────────────────────────────────────────────────

    op.create_table('cpf_submissions',
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('period', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('submission_date', sa.DateTime(timezone=True)),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('cpf91_file_url', sa.String(500)),
        sa.Column('total_employee_cpf', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('total_employer_cpf', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('total_sdl', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('iras_ref', sa.String(50)),
        sa.Column('notes', sa.Text()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id']),
        sa.UniqueConstraint('entity_id', 'period', name='uq_cpf_submissions_period'),
    )

    # ── Leave ───────────────────────────────────────────────────────────

    op.create_table('leave_types',
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(50), nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('is_paid', sa.Boolean(), nullable=False),
        sa.Column('is_statutory', sa.Boolean(), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('entity_id', 'code', name='uq_leave_type_code'),
    )

    op.create_table('leave_entitlements',
        sa.Column('employment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('leave_type_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('total_days', sa.Numeric(precision=4, scale=1), nullable=False),
        sa.Column('used_days', sa.Numeric(precision=4, scale=1), nullable=False),
        sa.Column('pending_days', sa.Numeric(precision=4, scale=1), nullable=False),
        sa.Column('carried_over_days', sa.Numeric(precision=4, scale=1), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['employment_id'], ['employments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['leave_type_id'], ['leave_types.id']),
        sa.UniqueConstraint('employment_id', 'leave_type_id', 'year', name='uq_leave_entitlement_year'),
    )

    op.create_table('leave_requests',
        sa.Column('employment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('leave_type_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('days_count', sa.Numeric(precision=4, scale=1), nullable=False),
        sa.Column('reason', sa.Text()),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('attachment_url', sa.String(500)),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True)),
        sa.Column('approved_at', sa.DateTime(timezone=True)),
        sa.Column('rejection_reason', sa.Text()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['approved_by'], ['users.id']),
        sa.ForeignKeyConstraint(['employment_id'], ['employments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['leave_type_id'], ['leave_types.id']),
    )

    # ── Attendance ──────────────────────────────────────────────────────

    op.create_table('shifts',
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('break_minutes', sa.Integer(), nullable=False),
        sa.Column('work_hours', sa.Numeric(precision=4, scale=2), nullable=False),
        sa.Column('is_overnight', sa.Boolean(), nullable=False),
        sa.Column('grace_minutes', sa.Integer(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
    )

    op.create_table('shift_roster',
        sa.Column('employment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('roster_date', sa.Date(), nullable=False),
        sa.Column('shift_id', postgresql.UUID(as_uuid=True)),
        sa.Column('day_type', sa.String(20), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id']),
        sa.ForeignKeyConstraint(['shift_id'], ['shifts.id']),
        sa.ForeignKeyConstraint(['employment_id'], ['employments.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('employment_id', 'roster_date', name='uq_shift_roster_date'),
    )

    op.create_table('attendance_records',
        sa.Column('employment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('work_date', sa.Date(), nullable=False),
        sa.Column('clock_in', sa.DateTime(timezone=True)),
        sa.Column('clock_out', sa.DateTime(timezone=True)),
        sa.Column('source', sa.String(20), nullable=False),
        sa.Column('is_approved', sa.Boolean(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id']),
        sa.ForeignKeyConstraint(['employment_id'], ['employments.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('employment_id', 'work_date', name='uq_attendance_record_date'),
    )

    op.create_table('daily_attendance',
        sa.Column('employment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('work_date', sa.Date(), nullable=False),
        sa.Column('scheduled_shift_id', postgresql.UUID(as_uuid=True)),
        sa.Column('actual_hours', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('scheduled_hours', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('normal_hours', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('ot_hours_1_5x', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('ot_hours_2x', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('is_absent', sa.Boolean(), nullable=False),
        sa.Column('lateness_minutes', sa.Integer(), nullable=False),
        sa.Column('early_leave_minutes', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['employment_id'], ['employments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['scheduled_shift_id'], ['shifts.id']),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id']),
        sa.UniqueConstraint('employment_id', 'work_date', name='uq_daily_attendance_date'),
    )

    op.create_table('monthly_ot_summary',
        sa.Column('employment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('period', sa.Date(), nullable=False),
        sa.Column('total_normal_hours', sa.Numeric(precision=7, scale=2), nullable=False),
        sa.Column('total_ot_hours', sa.Numeric(precision=7, scale=2), nullable=False),
        sa.Column('ot_hours_1_5x', sa.Numeric(precision=7, scale=2), nullable=False),
        sa.Column('ot_hours_2x', sa.Numeric(precision=7, scale=2), nullable=False),
        sa.Column('total_ot_pay', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('exceeds_72hr_limit', sa.Boolean(), nullable=False),
        sa.Column('is_finalized', sa.Boolean(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['employment_id'], ['employments.id']),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id']),
        sa.UniqueConstraint('employment_id', 'period', name='uq_monthly_ot_summary_period'),
    )

    # ── AI Features ─────────────────────────────────────────────────────

    op.create_table('ai_chat_sessions',
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True)),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('session_type', sa.String(50), nullable=False),
        sa.Column('title', sa.String(255)),
        sa.Column('messages', postgresql.JSONB(), nullable=False),
        sa.Column('context_data', postgresql.JSONB()),
        sa.Column('model_used', sa.String(100), nullable=False),
        sa.Column('tokens_used', sa.Integer(), nullable=False),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id']),
    )

    op.create_table('ai_attrition_scores',
        sa.Column('employment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('score_date', sa.Date(), nullable=False),
        sa.Column('risk_score', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('risk_level', sa.String(10), nullable=False),
        sa.Column('contributing_factors', postgresql.JSONB(), nullable=False),
        sa.Column('recommended_action', sa.Text()),
        sa.Column('is_actioned', sa.Boolean(), nullable=False),
        sa.Column('actioned_by', postgresql.UUID(as_uuid=True)),
        sa.Column('actioned_at', sa.DateTime(timezone=True)),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id']),
        sa.ForeignKeyConstraint(['actioned_by'], ['users.id']),
        sa.ForeignKeyConstraint(['employment_id'], ['employments.id']),
    )

    op.create_table('ai_audit_flags',
        sa.Column('payroll_run_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('employment_id', postgresql.UUID(as_uuid=True)),
        sa.Column('flag_type', sa.String(100), nullable=False),
        sa.Column('severity', sa.String(10), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('ai_reasoning', sa.Text()),
        sa.Column('suggested_action', sa.Text()),
        sa.Column('is_dismissed', sa.Boolean(), nullable=False),
        sa.Column('dismissed_by', postgresql.UUID(as_uuid=True)),
        sa.Column('dismissed_at', sa.DateTime(timezone=True)),
        sa.Column('dismissed_reason', sa.Text()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['dismissed_by'], ['users.id']),
        sa.ForeignKeyConstraint(['payroll_run_id'], ['payroll_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['employment_id'], ['payroll_records.id']),
    )

    # ── Tax ─────────────────────────────────────────────────────────────

    op.create_table('ir8a_records',
        sa.Column('employment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('year_of_assessment', sa.Integer(), nullable=False),
        sa.Column('gross_salary', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('bonus', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('total_income', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('submission_status', sa.String(20), nullable=False),
        sa.Column('ai_precheck_done', sa.Boolean(), nullable=False),
        sa.Column('ai_precheck_flags', postgresql.JSONB()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['employment_id'], ['employments.id']),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id']),
        sa.UniqueConstraint('employment_id', 'year_of_assessment', name='uq_ir8a_period'),
    )

    # ── Document Storage ────────────────────────────────────────────────

    op.create_table('document_storage',
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True)),
        sa.Column('doc_type', sa.String(50), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_url', sa.String(500), nullable=False),
        sa.Column('period', sa.Date()),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id']),
    )

    # ── Work Passes ─────────────────────────────────────────────────────

    op.create_table('work_passes',
        sa.Column('employment_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('pass_type', sa.String(50), nullable=False),
        sa.Column('pass_number', sa.String(50)),
        sa.Column('expiry_date', sa.Date(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('renewal_submitted_at', sa.DateTime(timezone=True)),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['employment_id'], ['employments.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('pass_number'),
    )


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_table('work_passes')
    op.drop_table('document_storage')
    op.drop_table('ir8a_records')
    op.drop_table('ai_audit_flags')
    op.drop_table('ai_attrition_scores')
    op.drop_table('ai_chat_sessions')
    op.drop_table('monthly_ot_summary')
    op.drop_table('daily_attendance')
    op.drop_table('attendance_records')
    op.drop_table('shift_roster')
    op.drop_table('shifts')
    op.drop_table('leave_requests')
    op.drop_table('leave_entitlements')
    op.drop_table('leave_types')
    op.drop_table('cpf_submissions')
    op.drop_table('claim_applications')
    op.drop_table('audit_flags')
    op.drop_table('payroll_records')
    op.drop_table('salary_structures')
    op.drop_table('payroll_runs')
    op.drop_table('employments')
    op.drop_table('customers')
    op.drop_table('groups')
    op.drop_table('grades')
    op.drop_table('departments')
    op.drop_table('bank_accounts')
    op.drop_table('audit_logs')
    op.drop_table('notifications')
    op.drop_table('user_entity_access')
    op.drop_table('role_permissions')
    op.drop_table('users')
    op.drop_table('system_audit_logs')
    op.drop_table('subscriptions')
    op.drop_table('roles')
    op.drop_table('persons')
    op.drop_table('entities')
    op.drop_table('tenants')
    op.drop_table('shg_rate_config')
    op.drop_table('sdl_rate_config')
    op.drop_table('platform_admins')
    op.drop_table('cpf_rate_config')
