import asyncio
import os
import sys
from uuid import UUID

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.tenant import Entity
from app.models.claims import ClaimCategory
from sqlalchemy import select

DEFAULT_CATEGORIES = [
    {"name": "Transport", "description": "Taxi, Grab, public transport, parking, toll fees"},
    {"name": "Medical", "description": "Doctor consultation, medicine, dental, health checkup"},
    {"name": "Entertainment", "description": "Business meals, client entertainment"},
    {"name": "Office Supplies", "description": "Stationery, pantry, small equipment"},
    {"name": "Mobile & Internet", "description": "Monthly bills, data roaming"},
    {"name": "Travel", "description": "Flights, hotel, per diem, visa fees"},
    {"name": "Training & Courses", "description": "Professional development, certifications"},
    {"name": "Other", "description": "Miscellaneous expenses"}
]

async def seed_claim_categories():
    print("Seeding Default Claim Categories...")
    async with AsyncSessionLocal() as session:
        # Get all entities
        result = await session.execute(select(Entity))
        entities = result.scalars().all()
        
        if not entities:
            print("No entities found. Skipping.")
            return

        total_seeded = 0
        for entity in entities:
            print(f"Processing Entity: {entity.name} ({entity.id})")
            
            for cat_data in DEFAULT_CATEGORIES:
                # Check if category already exists for this entity
                stmt = select(ClaimCategory).where(
                    ClaimCategory.entity_id == entity.id,
                    ClaimCategory.name == cat_data["name"]
                )
                existing = await session.execute(stmt)
                if existing.scalar_one_or_none():
                    continue
                
                new_cat = ClaimCategory(
                    tenant_id=entity.tenant_id,
                    entity_id=entity.id,
                    name=cat_data["name"],
                    description=cat_data["description"],
                    is_active=True
                )
                session.add(new_cat)
                total_seeded += 1
        
        await session.commit()
        print(f"Successfully seeded {total_seeded} categories across {len(entities)} entities.")

if __name__ == "__main__":
    asyncio.run(seed_claim_categories())
