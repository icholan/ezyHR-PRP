import asyncio
import os
import sys
from datetime import date
from decimal import Decimal

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import AsyncSessionLocal
from app.models.statutory import SHGRateConfig
from sqlalchemy import select

shg_data = [
    # CDAC
    {"shg_type": "CDAC", "wage_from": 0, "wage_to": 2000, "deduction_amount": 0.50},
    {"shg_type": "CDAC", "wage_from": 2000.01, "wage_to": 3500, "deduction_amount": 1.00},
    {"shg_type": "CDAC", "wage_from": 3500.01, "wage_to": 5000, "deduction_amount": 1.50},
    {"shg_type": "CDAC", "wage_from": 5000.01, "wage_to": 7500, "deduction_amount": 2.00},
    {"shg_type": "CDAC", "wage_from": 7500.01, "wage_to": 999999, "deduction_amount": 3.00},
    
    # MBMF
    {"shg_type": "MBMF", "wage_from": 0, "wage_to": 1000, "deduction_amount": 2.00},
    {"shg_type": "MBMF", "wage_from": 1000.01, "wage_to": 2000, "deduction_amount": 3.00},
    {"shg_type": "MBMF", "wage_from": 2000.01, "wage_to": 3000, "deduction_amount": 5.00},
    {"shg_type": "MBMF", "wage_from": 3000.01, "wage_to": 4000, "deduction_amount": 8.00},
    {"shg_type": "MBMF", "wage_from": 4000.01, "wage_to": 6000, "deduction_amount": 12.00},
    {"shg_type": "MBMF", "wage_from": 6000.01, "wage_to": 8000, "deduction_amount": 16.00},
    {"shg_type": "MBMF", "wage_from": 8000.01, "wage_to": 10000, "deduction_amount": 19.50},
    {"shg_type": "MBMF", "wage_from": 10000.01, "wage_to": 999999, "deduction_amount": 24.00},
    
    # SINDA
    {"shg_type": "SINDA", "wage_from": 0, "wage_to": 1000, "deduction_amount": 1.00},
    {"shg_type": "SINDA", "wage_from": 1000.01, "wage_to": 1500, "deduction_amount": 3.00},
    {"shg_type": "SINDA", "wage_from": 1500.01, "wage_to": 2500, "deduction_amount": 5.00},
    {"shg_type": "SINDA", "wage_from": 2500.01, "wage_to": 4500, "deduction_amount": 7.00},
    {"shg_type": "SINDA", "wage_from": 4500.01, "wage_to": 7500, "deduction_amount": 9.00},
    {"shg_type": "SINDA", "wage_from": 7500.01, "wage_to": 10000, "deduction_amount": 12.00},
    {"shg_type": "SINDA", "wage_from": 10000.01, "wage_to": 15000, "deduction_amount": 15.00},
    {"shg_type": "SINDA", "wage_from": 15000.01, "wage_to": 999999, "deduction_amount": 30.00},
    
    # ECF
    {"shg_type": "ECF", "wage_from": 0, "wage_to": 1000, "deduction_amount": 2.00},
    {"shg_type": "ECF", "wage_from": 1000.01, "wage_to": 1500, "deduction_amount": 4.00},
    {"shg_type": "ECF", "wage_from": 1500.01, "wage_to": 2500, "deduction_amount": 6.00},
    {"shg_type": "ECF", "wage_from": 2500.01, "wage_to": 4000, "deduction_amount": 9.00},
    {"shg_type": "ECF", "wage_from": 4000.01, "wage_to": 7000, "deduction_amount": 12.00},
    {"shg_type": "ECF", "wage_from": 7000.01, "wage_to": 10000, "deduction_amount": 16.00},
    {"shg_type": "ECF", "wage_from": 10000.01, "wage_to": 999999, "deduction_amount": 20.00},
]

async def seed_shg():
    async with AsyncSessionLocal() as db:
        print("Seeding SHG Rates...")
        for data in shg_data:
            # Check if exists
            query = select(SHGRateConfig).where(
                SHGRateConfig.shg_type == data["shg_type"],
                SHGRateConfig.wage_from == data["wage_from"]
            )
            result = await db.execute(query)
            existing = result.scalar_one_or_none()
            
            if existing:
                existing.wage_to = data["wage_to"]
                existing.deduction_amount = data["deduction_amount"]
                existing.is_expired = False
            else:
                config = SHGRateConfig(
                    **data,
                    effective_date=date(2024, 1, 1),
                    is_expired=False
                )
                db.add(config)
        
        await db.commit()
        print("SHG rates seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_shg())
