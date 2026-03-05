"""Add managed_group_ids to UserEntityAccess

Revision ID: 0dedd41cee1e
Revises: 0003
Create Date: 2026-03-03 15:50:57.148146

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0dedd41cee1e'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('user_entity_access', sa.Column('managed_group_ids', sa.ARRAY(sa.UUID()), nullable=True))


def downgrade() -> None:
    op.drop_column('user_entity_access', 'managed_group_ids')
