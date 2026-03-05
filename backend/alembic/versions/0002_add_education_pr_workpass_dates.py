"""add highest_education, pr_start_date, work_pass_start to persons

Revision ID: 0002
Revises: cfeca44774b9
Create Date: 2026-03-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0002'
down_revision: Union[str, None] = 'cfeca44774b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('persons', sa.Column('highest_education', sa.String(100), nullable=True))
    op.add_column('persons', sa.Column('pr_start_date', sa.Date(), nullable=True))
    op.add_column('persons', sa.Column('work_pass_start', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('persons', 'work_pass_start')
    op.drop_column('persons', 'pr_start_date')
    op.drop_column('persons', 'highest_education')
