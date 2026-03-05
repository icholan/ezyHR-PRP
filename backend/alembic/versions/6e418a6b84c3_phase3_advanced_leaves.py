"""phase3_advanced_leaves

Revision ID: 6e418a6b84c3
Revises: 97de9647d485
Create Date: 2026-03-05 13:18:41.951061

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6e418a6b84c3'
down_revision: Union[str, None] = '97de9647d485'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add child_birth_date to leave_requests
    op.add_column('leave_requests', sa.Column('child_birth_date', sa.Date(), nullable=True))
    # 2. Add family_id to persons
    op.add_column('persons', sa.Column('family_id', sa.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column('persons', 'family_id')
    op.drop_column('leave_requests', 'child_birth_date')
