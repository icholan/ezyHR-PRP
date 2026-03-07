import asyncio
import os
import sys
import uuid
from datetime import date

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.tenant import Entity
from app.models.leave import LeaveType, LeavePool
from sqlalchemy import select, and_

async def seed_leave_types():
    print("🚀 Seeding Standard Singapore Leave Types...")
    
    async with AsyncSessionLocal() as session:
        # 1. Get the Singapore HQ Entity
        result = await session.execute(select(Entity).where(Entity.name == "Singapore HQ"))
        entity = result.scalar_one_or_none()
        if not entity:
            print("❌ Entity 'Singapore HQ' not found. Please run seed_admins.py first.")
            return

        # 2. Setup Shared Sick & Hospitalisation Pool (Required for MOM Compliance)
        # Cap: 60 days total inclusive of outpatient sick leave
        pool_code = "SICK_HOSP_POOL"
        stmt = select(LeavePool).where(LeavePool.entity_id == entity.id, LeavePool.code == pool_code)
        sick_pool = (await session.execute(stmt)).scalar_one_or_none()
        
        if not sick_pool:
            sick_pool = LeavePool(
                entity_id=entity.id,
                code=pool_code,
                name="Sick & Hospitalisation Pool",
                cap_days=60.0,
                scope="employment",
                effective_from=date(2024, 1, 1)
            )
            session.add(sick_pool)
            await session.flush()
            print(f"✅ Created Leave Pool: {pool_code} (60 days)")
        else:
            print(f"⏭️ Pool {pool_code} already exists.")

        # 3. Define Standard Leave Types
        # format: (code, name, is_paid, is_statutory, pool_id, pool_sub_cap)
        leave_configs = [
            # Statutory
            ("AL", "Annual Leave", True, True, None, None),
            ("ML", "Medical (Outpatient)", True, True, sick_pool.id, 14.0),
            ("HL", "Hospitalisation", True, True, sick_pool.id, None),
            ("CL", "Childcare Leave", True, True, None, None),
            ("ECL", "Extended Childcare", True, True, None, None),
            ("MAT", "Maternity (GPML)", True, True, None, None),
            ("PAT", "Paternity (GPPL)", True, True, None, None),
            ("SPL", "Shared Parental", True, True, None, None),
            ("UPL", "Unpaid Infant Care", False, True, None, None),
            
            # Company Benefits (Non-Statutory)
            ("MAR", "Marriage Leave", True, False, None, None),
            ("COM", "Compassionate Leave", True, False, None, None),
            ("BDAY", "Birthday Leave", True, False, None, None),
            ("OIL", "Off-in-Lieu", True, False, None, None),
            ("VOL", "Volunteer Leave", True, False, None, None),
        ]

        created_count = 0
        updated_count = 0
        
        for code, name, is_paid, is_statutory, p_id, p_sub_cap in leave_configs:
            stmt = select(LeaveType).where(LeaveType.entity_id == entity.id, LeaveType.code == code)
            lt = (await session.execute(stmt)).scalar_one_or_none()
            
            if not lt:
                lt = LeaveType(
                    entity_id=entity.id,
                    code=code,
                    name=name,
                    is_paid=is_paid,
                    is_statutory=is_statutory,
                    pool_id=p_id,
                    pool_sub_cap=p_sub_cap,
                    is_active=True
                )
                session.add(lt)
                created_count += 1
            else:
                # Update existing if needed (e.g. attaching to pool)
                lt.pool_id = p_id
                lt.pool_sub_cap = p_sub_cap
                updated_count += 1
        
        await session.commit()
        print(f"✨ Seeding Complete! Created: {created_count}, Updated/Skipped: {updated_count}")

if __name__ == "__main__":
    asyncio.run(seed_leave_types())
