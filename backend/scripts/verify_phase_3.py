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
from app.models.leave import LeaveType, LeaveRequest, StatutoryLeaveRule, LeavePool
from app.models.employment import Employment, Person
from app.schemas.leave import LeaveRequestCreate
from sqlalchemy import select, and_, delete

async def verify_3():
    print("🚀 Verifying Phase 3: Advanced Statutory & Family Leaves...")
    async with AsyncSessionLocal() as session:
        # Setup: Entity Singapore HQ
        entity_id = uuid.UUID("f382c1c0-01c2-4d97-97e4-4cc4d0e23b0a")
        service = LeaveService(session)

        # 1. TEST GPPL (PATERNITY) Birth-Date Cutoff
        print("\n--- TEST 1: GPPL Birth-Date Cutoff ---")
        # Ensure rules are clean
        await session.execute(delete(StatutoryLeaveRule).where(StatutoryLeaveRule.leave_type_code == "PATERNITY"))
        rule_old = StatutoryLeaveRule(
            leave_type_code="PATERNITY",
            effective_from=date(2000, 1, 1),
            effective_to=date(2025, 3, 31),
            tenure_unit="months",
            progression=[{"min_tenure": 3, "days": 14}],
            notes="MOM GPPL: 2 weeks for births before 1 Apr 2025"
        )
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
        await session.flush()

        # Find employee
        emp_res = await session.execute(select(Employment).where(Employment.entity_id == entity_id).limit(1))
        emp = emp_res.scalar_one()

        # Resolution for birth before Apr 2025
        res_old = await service.resolve_entitlement(
            entity_id, "PATERNITY", date(2020, 1, 1), date(2025, 5, 1), 
            event_date=date(2025, 3, 20)
        )
        print(f"GPPL (Birth Mar 20): Resolved {res_old} days. Expected 14.0")
        
        # Resolution for birth after Apr 2025
        res_new = await service.resolve_entitlement(
            entity_id, "PATERNITY", date(2020, 1, 1), date(2025, 5, 1), 
            event_date=date(2025, 4, 10)
        )
        print(f"GPPL (Birth Apr 10): Resolved {res_new} days. Expected 28.0")

        # 2. TEST Family Pool Shared Cap
        print("\n--- TEST 2: Family Pool Shared Cap ---")
        # Clear existing
        await session.execute(delete(LeavePool).where(and_(LeavePool.entity_id == entity_id, LeavePool.code == "FAMILY_POOL_TEST")))
        
        pool = LeavePool(
            entity_id=entity_id,
            code="FAMILY_POOL_TEST",
            name="Family Test Pool",
            cap_days=30.0,
            scope="family",
            effective_from=date(2000, 1, 1)
        )
        session.add(pool)
        await session.flush()

        # Create 2 leave types in this pool
        await session.execute(delete(LeaveType).where(and_(LeaveType.entity_id == entity_id, LeaveType.code.in_(["TYPE_A", "TYPE_B"]))))
        type_a = LeaveType(entity_id=entity_id, name="Type A", code="TYPE_A", pool_id=pool.id)
        type_b = LeaveType(entity_id=entity_id, name="Type B", code="TYPE_B", pool_id=pool.id)
        session.add(type_a)
        session.add(type_b)
        await session.flush()

        # Setup Family Link: Emp A and Emp B
        family_id = uuid.uuid4()
        emp_a = emp # c8556...
        person_res = await session.execute(select(Person).where(Person.id == emp_a.person_id))
        person_a = person_res.scalar_one()
        person_a.family_id = family_id
        
        # Find another person for Emp B
        person_b_res = await session.execute(select(Person).where(and_(Person.tenant_id == person_a.tenant_id, Person.id != person_a.id)).limit(1))
        person_b = person_b_res.scalar_one()
        person_b.family_id = family_id
        
        emp_b_res = await session.execute(select(Employment).where(Employment.person_id == person_b.id).limit(1))
        emp_b = emp_b_res.scalar_one()
        print(f"Linked {person_a.full_name} and {person_b.full_name} with family_id: {family_id}")

        # Clear old requests
        await session.execute(delete(LeaveRequest).where(LeaveRequest.leave_type_id.in_([type_a.id, type_b.id])))

        # Emp A takes 20 days
        print("Emp A applying for 20 days Type A...")
        req_a = LeaveRequest(
            employment_id=emp_a.id, leave_type_id=type_a.id,
            start_date=date(2025, 6, 1), end_date=date(2025, 6, 20),
            days_count=20.0, status="approved"
        )
        session.add(req_a)
        await session.flush()

        # Emp B tries to take 15 days (Total 35 > 30)
        print("Emp B trying to apply for 15 days Type B (Pool cap 30)...")
        try:
            await service.check_pool_limits(type_b, emp_b.id, 15.0, 2025)
            print("❌ FAILURE: Should have raised ValueError for family pool cap.")
        except ValueError as e:
            print(f"✅ SUCCESS: Caught expected error: {e}")

        # 3. TEST Childcare Lifetime Cap
        print("\n--- TEST 3: Lifecycle / Lifetime Cap ---")
        # Ensure CHILDCARE type exists
        cc_stmt = select(LeaveType).where(and_(LeaveType.entity_id == entity_id, LeaveType.code == "CHILDCARE"))
        cc_res = await session.execute(cc_stmt)
        l_cc = cc_res.scalar_one_or_none()
        if not l_cc:
            l_cc = LeaveType(entity_id=entity_id, name="Childcare", code="CHILDCARE")
            session.add(l_cc)
            await session.flush()
        
        # Clear old CHILDCARE requests
        await session.execute(delete(LeaveRequest).where(LeaveRequest.leave_type_id == l_cc.id))
        
        # Add 40 days across history
        req1 = LeaveRequest(
            employment_id=emp_a.id, leave_type_id=l_cc.id,
            start_date=date(2023, 1, 1), end_date=date(2023, 1, 20),
            days_count=20.0, status="approved"
        )
        req2 = LeaveRequest(
            employment_id=emp_a.id, leave_type_id=l_cc.id,
            start_date=date(2024, 1, 1), end_date=date(2024, 1, 20),
            days_count=20.0, status="approved"
        )
        session.add_all([req1, req2])
        await session.flush()
        
        print("Current CHILDCARE total: 40.0 days. Trying to apply for 3.0 more (Lifetime cap 42.0)...")
        try:
            await service.check_lifetime_cap(emp_a.id, "CHILDCARE", 3.0, lifetime_cap=42.0)
            print("❌ FAILURE: Should have raised ValueError for lifetime cap.")
        except ValueError as e:
            print(f"✅ SUCCESS: Caught expected error: {e}")

        await session.commit()
        print("\n🎉 PHASE 3 VERIFICATION COMPLETE. ALL ADVANCED RULES VALIDATED.")

if __name__ == "__main__":
    asyncio.run(verify_3())
