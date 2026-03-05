import asyncio
import os
import sys
import uuid
from datetime import date

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.leave import StatutoryLeaveRule, LeavePool, LeaveType
from app.models.tenant import Entity
from sqlalchemy import select, and_

async def seed_phase3_rules():
    print("🌱 Seeding Phase 3: Advanced Statutory Rules...")
    async with AsyncSessionLocal() as session:
        # 0. Clean old rules for codes we are seeding
        from sqlalchemy import delete
        await session.execute(delete(StatutoryLeaveRule).where(StatutoryLeaveRule.leave_type_code.in_(["PATERNITY", "MATERNITY"])))
        
        # 1. GPPL (Paternity) Rule - Before Apr 2025 (14 days)
        # Note: PATERNITY is the code used in the design doc for GPPL
        rule_old = StatutoryLeaveRule(
            leave_type_code="PATERNITY",
            effective_from=date(2000, 1, 1),
            effective_to=date(2025, 3, 31),
            tenure_unit="months",
            progression=[{"min_tenure": 3, "days": 14}],
            notes="MOM GPPL: 2 weeks for births before 1 Apr 2025"
        )
        
        # 2. GPPL (Paternity) Rule - From Apr 2025 (28 days)
        rule_new = StatutoryLeaveRule(
            leave_type_code="PATERNITY",
            effective_from=date(2025, 4, 1),
            effective_to=None,
            tenure_unit="months",
            progression=[{"min_tenure": 3, "days": 28}],
            notes="MOM GPPL: 4 weeks for births from 1 Apr 2025"
        )
        
        session.add(rule_old)
        session.add(rule_new)
        
        # 3. MATERNITY Rule (16 weeks = 112 days)
        # Note: We'll keep it simple: 112 days after 3 months service.
        rule_mat = StatutoryLeaveRule(
            leave_type_code="MATERNITY",
            effective_from=date(2000, 1, 1),
            effective_to=None,
            tenure_unit="months",
            progression=[{"min_tenure": 3, "days": 112}],
            notes="MOM Maternity: 16 weeks (112 days) for SC children"
        )
        session.add(rule_mat)
        print("✅ Paternity & Maternity rules added.")

        # 3. SPL Pool - Shared across family
        # We need to add this to each entity or as a global template.
        # For now, let's find all entities and add it if missing.
        ent_res = await session.execute(select(Entity))
        entities = ent_res.scalars().all()
        
        for ent in entities:
            # Check if pool exists
            pool_stmt = select(LeavePool).where(
                and_(LeavePool.entity_id == ent.id, LeavePool.code == "SPL_POOL")
            )
            pool_res = await session.execute(pool_stmt)
            if not pool_res.scalar_one_or_none():
                pool = LeavePool(
                    entity_id=ent.id,
                    code="SPL_POOL",
                    name="Shared Parental Leave Pool",
                    cap_days=70.0, # 10 weeks (post Apr 2025) - we'll keep it simple for now
                    scope="family",
                    effective_from=date(2000, 1, 1),
                    notes="Government-paid shared parental leave pool"
                )
                session.add(pool)
                print(f"✅ SPL Pool added for Entity: {ent.name}")

        await session.commit()
        print("🚀 Seeding complete.")

if __name__ == "__main__":
    asyncio.run(seed_phase3_rules())
