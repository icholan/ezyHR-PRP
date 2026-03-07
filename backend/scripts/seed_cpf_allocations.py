import asyncio
import os
import sys
from datetime import date
from decimal import Decimal

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import AsyncSessionLocal
from app.models.statutory import CPFAllocationConfig

async def seed_cpf_allocations():
    print("Seeding CPF Allocation Ratios for 2026...")
    async with AsyncSessionLocal() as session:
        eff_date = date(2026, 1, 1)

        # Allocation Ratios from MOM/CPF Jan 2026 Document
        allocations = [
            {"age_from": 0, "age_to": 35, "oa_ratio": 0.6217, "sa_ratio": 0.1621, "ma_ratio": 0.2162},
            {"age_from": 35, "age_to": 45, "oa_ratio": 0.5677, "sa_ratio": 0.1891, "ma_ratio": 0.2432},
            {"age_from": 45, "age_to": 50, "oa_ratio": 0.5136, "sa_ratio": 0.2162, "ma_ratio": 0.2702},
            {"age_from": 50, "age_to": 55, "oa_ratio": 0.4055, "sa_ratio": 0.3108, "ma_ratio": 0.2837},
            {"age_from": 55, "age_to": 60, "oa_ratio": 0.3530, "sa_ratio": 0.3382, "ma_ratio": 0.3088}, # sa_ratio = RA for 55+
            {"age_from": 60, "age_to": 65, "oa_ratio": 0.1400, "sa_ratio": 0.4400, "ma_ratio": 0.4200},
            {"age_from": 65, "age_to": 70, "oa_ratio": 0.0607, "sa_ratio": 0.3030, "ma_ratio": 0.6363},
            {"age_from": 70, "age_to": 120, "oa_ratio": 0.0800, "sa_ratio": 0.0800, "ma_ratio": 0.8400},
        ]

        for alloc in allocations:
            # Check for existing
            from sqlalchemy import select, and_
            stmt = select(CPFAllocationConfig).where(and_(
                CPFAllocationConfig.age_from == alloc["age_from"],
                CPFAllocationConfig.effective_date == eff_date
            ))
            existing = (await session.execute(stmt)).scalar_one_or_none()

            if existing:
                for key, val in alloc.items():
                    setattr(existing, key, val)
                print(f"Updated Allocation: Age {alloc['age_from']}-{alloc['age_to']}")
            else:
                session.add(CPFAllocationConfig(**alloc, effective_date=eff_date))
                print(f"Added Allocation: Age {alloc['age_from']}-{alloc['age_to']}")

        await session.commit()
        print("\nCPF Allocation seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_cpf_allocations())
