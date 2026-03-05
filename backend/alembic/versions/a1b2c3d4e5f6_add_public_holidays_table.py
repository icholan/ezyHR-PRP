"""add public_holidays table

Revision ID: a1b2c3d4e5f6
Revises: cfdbccce6af0
Create Date: 2026-03-04 11:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'cfdbccce6af0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('public_holidays',
    sa.Column('entity_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=100), nullable=False),
    sa.Column('holiday_date', sa.Date(), nullable=False),
    sa.Column('observed_date', sa.Date(), nullable=True),
    sa.Column('is_recurring', sa.Boolean(), nullable=False, server_default='false'),
    sa.Column('year', sa.Integer(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['entity_id'], ['entities.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('entity_id', 'holiday_date', name='uq_entity_holiday_date')
    )


def downgrade() -> None:
    op.drop_table('public_holidays')
