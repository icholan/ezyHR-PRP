"""Phase 1: Add leave_pools, statutory_leave_rules, leave_type_policies tables
   and add pool_id / pool_sub_cap / is_active to leave_types.

Revision ID: 0010_phase1_leave_rules
Revises: dfc76306f105
Create Date: 2026-03-05
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import json
from datetime import date

revision: str = '0010_phase1_leave_rules'
down_revision: Union[str, None] = 'dfc76306f105'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. leave_pools (must come before leave_types FK) ─────────────────
    op.create_table('leave_pools',
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('code', sa.String(30), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('cap_days', sa.Numeric(precision=6, scale=1), nullable=False),
        sa.Column('scope', sa.String(20), nullable=False, server_default='employment'),
        sa.Column('effective_from', sa.Date(), nullable=False),
        sa.Column('effective_to', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('entity_id', 'code', 'effective_from', name='uq_leave_pool'),
    )

    # ── 2. statutory_leave_rules (global — no entity FK) ─────────────────
    op.create_table('statutory_leave_rules',
        sa.Column('leave_type_code', sa.String(30), nullable=False),
        sa.Column('effective_from', sa.Date(), nullable=False),
        sa.Column('effective_to', sa.Date(), nullable=True),
        sa.Column('tenure_unit', sa.String(10), nullable=False),  # 'months' | 'years'
        sa.Column('progression', postgresql.JSONB(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.UniqueConstraint('leave_type_code', 'effective_from', name='uq_statutory_rule'),
    )

    # ── 3. leave_type_policies (per-entity company overrides) ────────────
    op.create_table('leave_type_policies',
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('leave_type_code', sa.String(30), nullable=False),
        sa.Column('override_days', sa.Numeric(precision=6, scale=1), nullable=True),
        sa.Column('effective_from', sa.Date(), nullable=False),
        sa.Column('effective_to', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('entity_id', 'leave_type_code', 'effective_from', name='uq_leave_type_policy'),
    )

    # ── 4. Alter leave_types — add pool_id, pool_sub_cap, is_active ───────
    op.add_column('leave_types', sa.Column('pool_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('leave_types', sa.Column('pool_sub_cap', sa.Numeric(precision=6, scale=1), nullable=True))
    op.add_column('leave_types', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))

    op.create_foreign_key(
        'fk_leave_types_pool_id',
        'leave_types', 'leave_pools',
        ['pool_id'], ['id']
    )

    # ── 5. Seed MOM statutory rules ───────────────────────────────────────
    _seed_statutory_rules()


def _seed_statutory_rules():
    """Seed current MOM EA statutory progression tables."""
    conn = op.get_bind()

    rules = [
        # Annual Leave (MOM s.88A) — tenure_unit: years
        {
            'leave_type_code': 'ANNUAL',
            'tenure_unit': 'years',
            'effective_from': '2000-01-01',
            'effective_to': None,
            'notes': 'MOM EA s.88A Annual Leave staircase. Year 1 (0 completed yrs) = 7 days, caps at Year 8+ = 14 days.',
            'progression': json.dumps([
                {"min_tenure": 0, "days": 7},
                {"min_tenure": 1, "days": 8},
                {"min_tenure": 2, "days": 9},
                {"min_tenure": 3, "days": 10},
                {"min_tenure": 4, "days": 11},
                {"min_tenure": 5, "days": 12},
                {"min_tenure": 6, "days": 13},
                {"min_tenure": 7, "days": 14},
            ]),
        },
        # Outpatient Sick Leave — tenure_unit: months (sub-cap within SICK_POOL)
        {
            'leave_type_code': 'SICK',
            'tenure_unit': 'months',
            'effective_from': '2000-01-01',
            'effective_to': None,
            'notes': 'MOM EA outpatient sick leave. 14-day sub-cap within 60-day SICK_POOL.',
            'progression': json.dumps([
                {"min_tenure": 0,  "days": 0},
                {"min_tenure": 3,  "days": 5},
                {"min_tenure": 4,  "days": 8},
                {"min_tenure": 5,  "days": 11},
                {"min_tenure": 6,  "days": 14},
            ]),
        },
        # Hospitalisation Leave — tenure_unit: months (total SICK_POOL cap)
        {
            'leave_type_code': 'HOSPITALISATION',
            'tenure_unit': 'months',
            'effective_from': '2000-01-01',
            'effective_to': None,
            'notes': 'MOM EA hospitalisation leave. Total SICK_POOL pool size (inclusive of 14-day outpatient sub-cap).',
            'progression': json.dumps([
                {"min_tenure": 0,  "days": 0},
                {"min_tenure": 3,  "days": 15},
                {"min_tenure": 4,  "days": 30},
                {"min_tenure": 5,  "days": 45},
                {"min_tenure": 6,  "days": 60},
            ]),
        },
        # GPPL (Government-Paid Paternity Leave) — BEFORE Apr 2025: 2 weeks
        {
            'leave_type_code': 'PATERNITY',
            'tenure_unit': 'months',
            'effective_from': '2000-01-01',
            'effective_to': '2025-03-31',
            'notes': 'GPPL before 1 Apr 2025 birth: 2 weeks (14 days). Requires 3+ months service.',
            'progression': json.dumps([
                {"min_tenure": 0, "days": 0},
                {"min_tenure": 3, "days": 14},
            ]),
        },
        # GPPL (Government-Paid Paternity Leave) — FROM Apr 2025: 4 weeks
        {
            'leave_type_code': 'PATERNITY',
            'tenure_unit': 'months',
            'effective_from': '2025-04-01',
            'effective_to': None,
            'notes': 'GPPL from 1 Apr 2025 birth: 4 weeks (28 days). Requires 3+ months service.',
            'progression': json.dumps([
                {"min_tenure": 0, "days": 0},
                {"min_tenure": 3, "days": 28},
            ]),
        },
    ]

    for rule in rules:
        # Use CAST(:param AS jsonb) instead of :param::jsonb to avoid SQLAlchemy bind conflict
        conn.execute(
            sa.text(
                "INSERT INTO statutory_leave_rules "
                "(id, leave_type_code, effective_from, effective_to, tenure_unit, progression, notes, created_at, updated_at) "
                "VALUES (gen_random_uuid(), :code, :eff_from, :eff_to, :unit, CAST(:prog AS jsonb), :notes, now(), now()) "
                "ON CONFLICT (leave_type_code, effective_from) DO NOTHING"
            ).bindparams(
                code=rule['leave_type_code'],
                eff_from=rule['effective_from'],
                eff_to=rule['effective_to'],
                unit=rule['tenure_unit'],
                prog=rule['progression'],
                notes=rule.get('notes', ''),
            )
        )


def downgrade() -> None:
    op.drop_constraint('fk_leave_types_pool_id', 'leave_types', type_='foreignkey')
    op.drop_column('leave_types', 'is_active')
    op.drop_column('leave_types', 'pool_sub_cap')
    op.drop_column('leave_types', 'pool_id')
    op.drop_table('leave_type_policies')
    op.drop_table('statutory_leave_rules')
    op.drop_table('leave_pools')
