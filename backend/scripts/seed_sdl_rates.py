import asyncio
import os
import sys
from datetime import date
from decimal import Decimal

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import AsyncSessionLocal
from app.models.statutory import SDLRateConfig
from sqlalchemy import select

sdl_data = [
    {
        "rate": 0.0025,
        "min_amount": 2.00,
        "max_amount": 11.25,
        "effective_date": date(2024, 1, 1),
        "is_expired": False
    }
]

async def seed_sdl():
    async with AsyncSessionLocal() as db:
        print("Seeding SDL Rates...")
        for data in sdl_data:
            # Check if exists for same effective date
            query = select(SDLRateConfig).where(
                SDLRateConfig.effective_date == data["effective_date"]
            )
            result = await db.execute(query)
            existing = result.scalar_one_or_none()
            
            if existing:
                existing.rate = data["rate"]
                existing.min_amount = data["min_amount"]
                existing.max_amount = data["max_amount"]
                existing.is_expired = False
            else:
                config = SDLRateConfig(**data)
                db.add(config)
        
        await db.commit()
        print("SDL rates seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_sdl())
