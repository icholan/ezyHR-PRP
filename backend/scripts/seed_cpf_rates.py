import asyncio
import os
import sys
from datetime import date
from decimal import Decimal

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import AsyncSessionLocal
from app.models.statutory import CPFRateConfig

async def seed_cpf_rates():
    print("Seeding MOM CPF Rates (2024-2026)...")
    async with AsyncSessionLocal() as session:
        # Standard rates for SC/SPR (Year 3+)
        # This is a simplified subset for common use cases
        rates = [
            # --- 2024 (OW Ceiling: $6,800) ---
            {
                "citizenship_type": "SC",
                "age_from": 0, "age_to": 55,
                "employee_rate": 0.20, "employer_rate": 0.17,
                "ow_ceiling": 6800.0, "aw_ceiling_annual": 102000.0,
                "effective_date": date(2024, 1, 1), "end_date": date(2024, 12, 31)
            },
            {
                "citizenship_type": "SC",
                "age_from": 55, "age_to": 60,
                "employee_rate": 0.15, "employer_rate": 0.145, # rates changed in 2024
                "ow_ceiling": 6800.0, "aw_ceiling_annual": 102000.0,
                "effective_date": date(2024, 1, 1), "end_date": date(2024, 12, 31)
            },
            # --- 2025 (OW Ceiling: $7,400) ---
            {
                "citizenship_type": "SC",
                "age_from": 0, "age_to": 55,
                "employee_rate": 0.20, "employer_rate": 0.17,
                "ow_ceiling": 7400.0, "aw_ceiling_annual": 102000.0,
                "effective_date": date(2025, 1, 1), "end_date": date(2025, 12, 31)
            },
            # --- 2026 (OW Ceiling: $8,000) ---
            {
                "citizenship_type": "SC",
                "age_from": 0, "age_to": 55,
                "employee_rate": 0.20, "employer_rate": 0.17,
                "ow_ceiling": 8000.0, "aw_ceiling_annual": 102000.0,
                "effective_date": date(2026, 1, 1), "end_date": None
            },
        ]

        for r_data in rates:
            # Check if exists
            from sqlalchemy import select, and_
            stmt = select(CPFRateConfig).where(and_(
                CPFRateConfig.citizenship_type == r_data["citizenship_type"],
                CPFRateConfig.age_from == r_data["age_from"],
                CPFRateConfig.effective_date == r_data["effective_date"]
            ))
            existing = (await session.execute(stmt)).scalar_one_or_none()
            
            if not existing:
                rate = CPFRateConfig(**r_data)
                session.add(rate)
                print(f"Added rate for {r_data['citizenship_type']} (Age {r_data['age_from']}-{r_data['age_to']}) starting {r_data['effective_date']}")

        await session.commit()
        print("MOM CPF Rates seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_cpf_rates())
