import asyncio
import os
import sys
from datetime import date

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.tenant import Entity
from app.models.leave import LeaveType, StatutoryLeaveRule, LeaveCarryPolicy
from sqlalchemy import select

async def seed_statutory_rules():
    print("🚀 Seeding MOM Statutory Leave Rules safely...")
    
    async with AsyncSessionLocal() as session:
        # Assuming the development seeder or production created Singapore HQ
        result = await session.execute(select(Entity).where(Entity.name == "Singapore HQ"))
        entity = result.scalar_one_or_none()
        
        if not entity:
            print("❌ Error: 'Singapore HQ' Entity not found. Run main seeder first.")
            return

        # Fetch all leave types dynamically
        result = await session.execute(select(LeaveType).where(LeaveType.entity_id == entity.id))
        leave_types = result.scalars().all()
        leave_type_map = {lt.code: lt for lt in leave_types}

        if 'AL' not in leave_type_map:
            print("❌ Error: MOM Leave Types (AL, ML, etc.) not found. Please run the updated main seeder first.")
            return

        effective_date = date(2025, 1, 1) # Standardized effective retro-date
        
        rules_to_create = []
        carry_policies_to_create = []

        # Helper logic to check if rule exists before inserting
        async def rule_exists(code):
            stmt = select(StatutoryLeaveRule).where(
                StatutoryLeaveRule.leave_type_code == code,
                StatutoryLeaveRule.effective_from == effective_date
            )
            return (await session.execute(stmt)).scalar_one_or_none() is not None

        async def carry_exists(code):
            stmt = select(LeaveCarryPolicy).where(
                LeaveCarryPolicy.leave_type_code == code,
                LeaveCarryPolicy.effective_from == effective_date,
                LeaveCarryPolicy.entity_id == entity.id
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
        
        if not await carry_exists("AL"):
            carry_policies_to_create.append(LeaveCarryPolicy(
                entity_id=entity.id, leave_type_code="AL",
                max_carry_days=14.0, carry_expiry_months=12,
                effective_from=effective_date
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
            
        if carry_policies_to_create:
            session.add_all(carry_policies_to_create)
            print(f"✅ Inserted {len(carry_policies_to_create)} Leave Carry Policies.")
        else:
            print("⏭️ Leave Carry Policies already exist.")

        await session.commit()
        print("✨ Rule Seeding Complete!")

if __name__ == "__main__":
    asyncio.run(seed_statutory_rules())
