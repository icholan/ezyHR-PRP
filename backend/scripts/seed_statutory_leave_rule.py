import asyncio
import os
import sys
from datetime import date

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.leave import StatutoryLeaveRule
from sqlalchemy import select
from sqlalchemy import select

async def seed_statutory_rules():
    print("🚀 Seeding MOM Statutory Leave Rules safely...")
    
    async with AsyncSessionLocal() as session:
        effective_date = date(2025, 1, 1) # Standardized effective retro-date
        
        rules_to_create = []

        # Helper logic to check if rule exists before inserting
        async def rule_exists(code):
            stmt = select(StatutoryLeaveRule).where(
                StatutoryLeaveRule.leave_type_code == code,
                StatutoryLeaveRule.effective_from == effective_date
            )
            return (await session.execute(stmt)).scalar_one_or_none() is not None

        # 1. Annual Leave (AL) - Years Progression
        if not await rule_exists("AL"):
            al_prog = [
                {"min_tenure": 0, "days": 7}, {"min_tenure": 1, "days": 8},
                {"min_tenure": 2, "days": 9}, {"min_tenure": 3, "days": 10},
                {"min_tenure": 4, "days": 11}, {"min_tenure": 5, "days": 12},
                {"min_tenure": 6, "days": 13}, {"min_tenure": 7, "days": 14}
            ]
            rules_to_create.append(StatutoryLeaveRule(
                leave_type_code="AL", effective_from=effective_date,
                tenure_unit="years", progression=al_prog
            ))

        # 2. Medical Leave (ML) - Months Progression
        if not await rule_exists("ML"):
            ml_prog = [
                {"min_tenure": 0, "days": 0}, {"min_tenure": 3, "days": 5},
                {"min_tenure": 4, "days": 8}, {"min_tenure": 5, "days": 11},
                {"min_tenure": 6, "days": 14}
            ]
            rules_to_create.append(StatutoryLeaveRule(
                leave_type_code="ML", effective_from=effective_date,
                tenure_unit="months", progression=ml_prog
            ))

        # 3. Hospitalisation Leave (HL) - Months Progression
        if not await rule_exists("HL"):
            hl_prog = [
                {"min_tenure": 0, "days": 0}, {"min_tenure": 3, "days": 15},
                {"min_tenure": 4, "days": 30}, {"min_tenure": 5, "days": 45},
                {"min_tenure": 6, "days": 60}
            ]
            rules_to_create.append(StatutoryLeaveRule(
                leave_type_code="HL", effective_from=effective_date,
                tenure_unit="months", progression=hl_prog
            ))

        # Flat Progressions (Years)
        flat_rules = [
            ("CL", 6),    # Childcare
            ("ECL", 2),   # Extended Childcare
            ("MAT", 112), # Maternity (16 wks)
            ("PAT", 28),  # Paternity (4 wks)
            ("SPL", 0),   # Shared Parental (Transfers only)
            ("UPL", 12)   # Unpaid Infant Care
        ]

        for code, days in flat_rules:
            if not await rule_exists(code):
                rules_to_create.append(StatutoryLeaveRule(
                    leave_type_code=code, effective_from=effective_date,
                    tenure_unit="years", progression=[{"min_tenure": 0, "days": days}]
                ))

        if rules_to_create:
            session.add_all(rules_to_create)
            print(f"✅ Inserted {len(rules_to_create)} Statutory Leave Rules.")
        else:
            print("⏭️ Statutory Leave Rules already exist.")

        await session.commit()
        print("✨ Rule Seeding Complete!")

if __name__ == "__main__":
    asyncio.run(seed_statutory_rules())
