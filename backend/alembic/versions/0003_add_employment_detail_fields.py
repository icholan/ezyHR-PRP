"""Add employment detail fields (cessation, hours, designation)

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('employments', sa.Column('cessation_date', sa.Date(), nullable=True))
    op.add_column('employments', sa.Column('designation', sa.String(100), nullable=True))
    op.add_column('employments', sa.Column('working_days_per_week', sa.Numeric(3, 1), nullable=True))
    op.add_column('employments', sa.Column('rest_day', sa.String(20), nullable=True))
    op.add_column('employments', sa.Column('work_hours_per_day', sa.Numeric(4, 1), nullable=True))
    op.add_column('employments', sa.Column('normal_work_hours_per_week', sa.Numeric(4, 1), nullable=True))

def downgrade() -> None:
    op.drop_column('employments', 'normal_work_hours_per_week')
    op.drop_column('employments', 'work_hours_per_day')
    op.drop_column('employments', 'rest_day')
    op.drop_column('employments', 'working_days_per_week')
    op.drop_column('employments', 'designation')
    op.drop_column('employments', 'cessation_date')
