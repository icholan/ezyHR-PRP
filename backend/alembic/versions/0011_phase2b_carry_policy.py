"""Phase 2B: Add leave_carry_policies table.

Revision ID: 0011_phase2b_carry_policy
Revises: 0010_phase1_leave_rules
Create Date: 2026-03-05
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '0011_phase2b_carry_policy'
down_revision: Union[str, None] = '0010_phase1_leave_rules'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── leave_carry_policies ──────────────────────────────────────────
    op.create_table('leave_carry_policies',
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('leave_type_code', sa.String(30), nullable=False),
        sa.Column('max_carry_days', sa.Numeric(precision=6, scale=1), nullable=False),
        sa.Column('carry_expiry_months', sa.Integer(), nullable=True),
        sa.Column('effective_from', sa.Date(), nullable=False),
        sa.Column('effective_to', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('entity_id', 'leave_type_code', 'effective_from', name='uq_leave_carry_policy'),
    )


def downgrade() -> None:
    op.drop_table('leave_carry_policies')
