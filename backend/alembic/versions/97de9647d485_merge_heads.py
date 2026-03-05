"""merge heads

Revision ID: 97de9647d485
Revises: 0011_phase2b_carry_policy, 462f4e9b540a
Create Date: 2026-03-05 13:18:34.514639

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '97de9647d485'
down_revision: Union[str, None] = ('0011_phase2b_carry_policy', '462f4e9b540a')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
