"""add is_deleted to shifts

Revision ID: be145a03f357
Revises: a1b2c3d4e5f6
Create Date: 2026-03-04 13:06:16.605945

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'be145a03f357'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shifts', sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade() -> None:
    op.drop_column('shifts', 'is_deleted')
