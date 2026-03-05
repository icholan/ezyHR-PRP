"""add mobile_number, whatsapp_number, language to persons

Revision ID: 0001
Revises:
Create Date: 2026-03-03

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0001'
down_revision: Union[str, None] = '0000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('persons', sa.Column('mobile_number', sa.String(20), nullable=True))
    op.add_column('persons', sa.Column('whatsapp_number', sa.String(20), nullable=True))
    op.add_column('persons', sa.Column('language', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('persons', 'language')
    op.drop_column('persons', 'whatsapp_number')
    op.drop_column('persons', 'mobile_number')
