"""add_nric_and_emp_code_uniqueness

Revision ID: bb5108d1fcf4
Revises: ed44efe77105
Create Date: 2026-03-06 13:27:54.257621

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bb5108d1fcf4'
down_revision: Union[str, None] = 'ed44efe77105'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


import sys
import os
# Ensure app is importable
sys.path.append(os.getcwd())

from app.core.security.encryption import encryptor

def upgrade() -> None:
    # 1. Add nric_fin_hash column to persons
    op.add_column('persons', sa.Column('nric_fin_hash', sa.String(length=64), nullable=True))
    op.create_index(op.f('ix_persons_nric_fin_hash'), 'persons', ['nric_fin_hash'], unique=False)

    # 2. Cleanup duplicate employee_code in employments
    # Find duplicates and append _DUP_suffix
    bind = op.get_bind()
    dupes = bind.execute(sa.text("""
        SELECT id, employee_code, entity_id 
        FROM employments 
        WHERE (entity_id, employee_code) IN (
            SELECT entity_id, employee_code 
            FROM employments 
            WHERE employee_code IS NOT NULL 
            GROUP BY entity_id, employee_code 
            HAVING COUNT(*) > 1
        )
        ORDER BY entity_id, employee_code, created_at
    """)).fetchall()
    
    seen = {} # (entity_id, code) -> count
    for row in dupes:
        key = (row.entity_id, row.employee_code)
        if key not in seen:
            seen[key] = 1
        else:
            seen[key] += 1
            new_code = f"{row.employee_code}_DUP_{seen[key]-1}"
            bind.execute(sa.text("UPDATE employments SET employee_code = :new_code WHERE id = :id"), {"new_code": new_code, "id": row.id})

    # 3. Backfill nric_fin_hash for all persons
    persons = bind.execute(sa.text("SELECT id, nric_fin FROM persons WHERE nric_fin IS NOT NULL")).fetchall()
    for p in persons:
        dec = encryptor.decrypt(p.nric_fin)
        if dec:
            h = encryptor.get_hash(dec)
            bind.execute(sa.text("UPDATE persons SET nric_fin_hash = :h WHERE id = :id"), {"h": h, "id": p.id})

    # 4. Add Unique Constraints
    # Drop existing NRIC constraint first (it was on nric_fin)
    op.drop_constraint('uq_persons_nric', 'persons', type_='unique')
    op.create_unique_constraint('uq_persons_nric', 'persons', ['tenant_id', 'nric_fin_hash'])
    
    op.create_unique_constraint('uq_employment_code', 'employments', ['entity_id', 'employee_code'])


def downgrade() -> None:
    op.drop_constraint('uq_employment_code', 'employments', type_='unique')
    op.drop_constraint('uq_persons_nric', 'persons', type_='unique')
    
    # Re-add old constraint on nric_fin
    op.create_unique_constraint('uq_persons_nric', 'persons', ['tenant_id', 'nric_fin'])
    
    op.drop_index(op.f('ix_persons_nric_fin_hash'), table_name='persons')
    op.drop_column('persons', 'nric_fin_hash')

