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

async def link_pools():
    print("🚀 Starting Pool Linkage Setup...")
    async with AsyncSessionLocal() as session:
        # 1. Get all entities
        result = await session.execute(select(Entity))
        entities = result.scalars().all()
        print(f"🔍 Found {len(entities)} entities.")

        for entity in entities:
            print(f"--- Processing Entity: {entity.name} ({entity.id}) ---")
            
            # 2. Check for SICK_POOL
            pool_result = await session.execute(
                select(LeavePool).where(
                    and_(
                        LeavePool.entity_id == entity.id,
                        LeavePool.code == "SICK_POOL"
                    )
                )
            )
            sick_pool = pool_result.scalar_one_or_none()
            
            if not sick_pool:
                sick_pool = LeavePool(
                    entity_id=entity.id,
                    code="SICK_POOL",
                    name="Sick & Hospitalisation Pool",
                    cap_days=60.0,
                    scope="employment",
                    effective_from=date(2000, 1, 1),
                    notes="MOM EA s.89 shared cap for outpatient and hospitalisation leave."
                )
                session.add(sick_pool)
                await session.flush()
                print(f"✅ Created SICK_POOL for {entity.name}")
            else:
                print(f"⏭️ SICK_POOL already exists for {entity.name}")

            # 3. Link SICK leave type
            sick_type_result = await session.execute(
                select(LeaveType).where(
                    and_(
                        LeaveType.entity_id == entity.id,
                        LeaveType.code == "SICK"
                    )
                )
            )
            sick_type = sick_type_result.scalar_one_or_none()
            if sick_type:
                sick_type.pool_id = sick_pool.id
                sick_type.pool_sub_cap = 14.0
                print(f"✅ Linked SICK type to pool (sub-cap: 14)")
            else:
                print(f"⚠️ SICK type not found for {entity.name}")

            # 4. Link HOSPITALISATION leave type
            hosp_type_result = await session.execute(
                select(LeaveType).where(
                    and_(
                        LeaveType.entity_id == entity.id,
                        LeaveType.code == "HOSPITALISATION"
                    )
                )
            )
            hosp_type = hosp_type_result.scalar_one_or_none()
            if hosp_type:
                hosp_type.pool_id = sick_pool.id
                hosp_type.pool_sub_cap = None
                print(f"✅ Linked HOSPITALISATION type to pool")
            else:
                print(f"⚠️ HOSPITALISATION type not found for {entity.name}")

        await session.commit()
        print("🎉 Pool linkage setup complete.")

if __name__ == "__main__":
    asyncio.run(link_pools())
