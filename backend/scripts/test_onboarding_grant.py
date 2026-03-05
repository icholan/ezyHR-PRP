import asyncio
import os
import sys
import uuid
from datetime import date

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.services.employee import EmployeeService
from app.schemas.employee import EmployeeFullCreate, PersonCreate, EmploymentCreate
from app.models.leave import LeaveEntitlement
from sqlalchemy import select

async def test_onboarding():
    print("🚀 Testing Onboarding Auto-Grant...")
    async with AsyncSessionLocal() as session:
        # 1. Setup - use entity with leave types
        from app.models.tenant import Entity
        entity_id = uuid.UUID("f382c1c0-01c2-4d97-97e4-4cc4d0e23b0a")
        res = await session.execute(select(Entity).where(Entity.id == entity_id))
        entity = res.scalar_one_or_none()
        if not entity:
            print("❌ No entity found to test with.")
            return

        # 2. Create mock employee data
        unique_id = str(uuid.uuid4())[:8]
        data = EmployeeFullCreate(
            person=PersonCreate(
                full_name=f"Test Employee {unique_id}",
                nric_fin=f"S1234{unique_id}A",
                nationality="Singaporean",
                personal_email=f"test_{unique_id}@example.com",
                gender="male",
                date_of_birth=date(1990, 1, 1)
            ),
            employment=EmploymentCreate(
                entity_id=entity.id,
                employee_code=f"EMP-{unique_id}",
                job_title="Software Engineer",
                employment_type="full_time",
                citizenship_type="citizen",
                join_date=date.today(),
                basic_salary=5000.0
            )
        )

        service = EmployeeService(session)
        print(f"🎬 Creating employee: {data.person.full_name}...")
        emp = await service.create_employee(entity.tenant_id, data)
        print(f"✅ Employee created with ID: {emp.id}")

        # 3. Verify Leave Entitlements
        ent_stmt = select(LeaveEntitlement).where(LeaveEntitlement.employment_id == emp.id)
        ent_res = await session.execute(ent_stmt)
        entitlements = ent_res.scalars().all()

        print(f"📉 Found {len(entitlements)} leave entitlement records.")
        for ent in entitlements:
            # Note: We can't easily get leave type name without join, but we can verify counts
            print(f"   - Type ID: {ent.leave_type_id}, Year: {ent.year}, Total: {ent.total_days} days")

        if len(entitlements) > 0:
            print("🎉 SUCCESS: Leave entitlements automatically granted.")
        else:
            print("❌ FAILURE: No leave entitlements found.")

        # Cleanup (optional, but good for repetitive tests)
        # await session.delete(emp)
        # await session.commit()

if __name__ == "__main__":
    asyncio.run(test_onboarding())
