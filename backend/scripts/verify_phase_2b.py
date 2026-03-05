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

async def verify_2b():
    print("🚀 Verifying Phase 2B: Jan 1 Task & Carry-Forward...")
    async with AsyncSessionLocal() as session:
        # 1. Setup - use entity Singapore HQ
        entity_id = uuid.UUID("f382c1c0-01c2-4d97-97e4-4cc4d0e23b0a")
        
        # 2. Setup Carry Policy for ANNUAL (max 7 days)
        # Clear existing for test reproducibility
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
            carry_expiry_months=3,
            effective_from=date(2000, 1, 1),
            notes="Test policy: max 7 days carry"
        )
        session.add(policy)
        await session.flush()
        print("✅ Carry Policy Created: ANNUAL max 7 days")

        # 3. Find an employee and setup 2025 balance
        from app.models.employment import Employment
        emp_res = await session.execute(select(Employment).where(Employment.entity_id == entity_id).limit(1))
        emp = emp_res.scalar_one_or_none()
        if not emp:
            print("❌ No employee found in entity.")
            return

        lt_res = await session.execute(select(LeaveType).where(and_(LeaveType.entity_id == entity_id, LeaveType.code == "ANNUAL")))
        lt_annual = lt_res.scalar_one_or_none()
        
        # Clear existing 2025/2026 for this employee to be clean
        await session.execute(
            delete(LeaveEntitlement).where(
                and_(
                    LeaveEntitlement.employment_id == emp.id,
                    LeaveEntitlement.leave_type_id == lt_annual.id,
                    LeaveEntitlement.year.in_([2025, 2026])
                )
            )
        )

        # Create 2025 entitlement with 10 unused days
        # total=14, used=4 -> unused=10
        ent_2025 = LeaveEntitlement(
            employment_id=emp.id,
            leave_type_id=lt_annual.id,
            year=2025,
            total_days=14.0,
            used_days=4.0,
            pending_days=0.0,
            carried_over_days=0.0
        )
        session.add(ent_2025)
        await session.flush()
        print(f"✅ Mock 2025 Entitlement Created for {emp.id}: 10 unused days.")

        # 4. Trigger Annual Grant for 2026
        service = LeaveService(session)
        print("🎬 Running Annual Grant for 2026...")
        results = await service.grant_new_year_entitlements(2026)
        print(f"📊 Results: {results}")

        # 5. Verify 2026 record
        stmt = select(LeaveEntitlement).where(
            and_(
                LeaveEntitlement.employment_id == emp.id,
                LeaveEntitlement.leave_type_id == lt_annual.id,
                LeaveEntitlement.year == 2026
            )
        )
        res = await session.execute(stmt)
        ent_2026 = res.scalar_one_or_none()

        if ent_2026:
            print(f"🧐 2026 Entitlement: total={ent_2026.total_days}, carried_over={ent_2026.carried_over_days}")
            if float(ent_2026.carried_over_days) == 7.0:
                print("🎉 SUCCESS: Carry-forward correctly capped at 7 days.")
            else:
                print(f"❌ FAILURE: Expected 7.0 carry-over, got {ent_2026.carried_over_days}")
        else:
            print("❌ FAILURE: 2026 entitlement record not found.")

        # Keep everything committed for review
        await session.commit()

if __name__ == "__main__":
    asyncio.run(verify_2b())
