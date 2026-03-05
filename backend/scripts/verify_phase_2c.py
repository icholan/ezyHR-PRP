import asyncio
import os
import sys
import uuid
from datetime import date

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.services.leave import LeaveService
from app.models.leave import LeaveType, LeaveEntitlement, LeaveCarryPolicy
from sqlalchemy import select, and_, delete

async def verify_2c():
    print("🚀 Verifying Phase 2C: Carry Expiry Job...")
    async with AsyncSessionLocal() as session:
        # 1. Setup - use entity Singapore HQ
        entity_id = uuid.UUID("f382c1c0-01c2-4d97-97e4-4cc4d0e23b0a")
        
        # 2. Setup Carry Policy for ANNUAL (max 7 days, 3 months expiry)
        # Clear existing
        await session.execute(
            delete(LeaveCarryPolicy).where(
                and_(
                    LeaveCarryPolicy.entity_id == entity_id,
                    LeaveCarryPolicy.leave_type_code == "ANNUAL"
                )
            )
        )
        
        policy = LeaveCarryPolicy(
            entity_id=entity_id,
            leave_type_code="ANNUAL",
            max_carry_days=7.0,
            carry_expiry_months=3, # Expiry: March 31
            effective_from=date(2000, 1, 1),
            notes="Test policy: 3 months expiry"
        )
        session.add(policy)
        await session.flush()
        print("✅ Carry Policy Created: ANNUAL 3 months expiry")

        # 3. Setup Entitlement with carry-over
        from app.models.employment import Employment
        emp_res = await session.execute(select(Employment).where(Employment.entity_id == entity_id).limit(1))
        emp = emp_res.scalar_one_or_none()
        
        lt_res = await session.execute(select(LeaveType).where(and_(LeaveType.entity_id == entity_id, LeaveType.code == "ANNUAL")))
        lt_annual = lt_res.scalar_one_or_none()
        
        # Setup 2026 record with 7 days carry
        await session.execute(
            delete(LeaveEntitlement).where(
                and_(
                    LeaveEntitlement.employment_id == emp.id,
                    LeaveEntitlement.leave_type_id == lt_annual.id,
                    LeaveEntitlement.year == 2026
                )
            )
        )
        
        ent_2026 = LeaveEntitlement(
            employment_id=emp.id,
            leave_type_id=lt_annual.id,
            year=2026,
            total_days=14.0,
            used_days=0.0,
            pending_days=0.0,
            carried_over_days=7.0
        )
        session.add(ent_2026)
        await session.flush()
        print(f"✅ Mock 2026 Entitlement Created for {emp.id}: 7.0 days carry-over.")

        service = LeaveService(session)

        # 4. Test Before Expiry (March 31)
        print("🎬 Running Expiry Check for 2026-03-31...")
        results = await service.expire_carried_leave(date(2026, 3, 31))
        print(f"📊 Results: {results}")
        
        await session.refresh(ent_2026)
        if float(ent_2026.carried_over_days) == 7.0:
            print("✅ PRE-EXPIRY: Carry balance preserved correctly.")
        else:
            print(f"❌ FAILURE: Expected 7.0, got {ent_2026.carried_over_days}")

        # 5. Test After Expiry (April 1)
        print("🎬 Running Expiry Check for 2026-04-01...")
        results = await service.expire_carried_leave(date(2026, 4, 1))
        print(f"📊 Results: {results}")

        await session.refresh(ent_2026)
        if float(ent_2026.carried_over_days) == 0.0:
            print("🎉 SUCCESS: Carry-forward correctly expired to 0.0 days.")
        else:
            print(f"❌ FAILURE: Expected 0.0 carry-over, got {ent_2026.carried_over_days}")

        await session.commit()

if __name__ == "__main__":
    asyncio.run(verify_2c())
