import asyncio
import os
import sys
from datetime import date
from decimal import Decimal

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.core.database import AsyncSessionLocal
from app.models.statutory import CPFRateConfig

async def seed_cpf_2026_comprehensive():
    print("Seeding Comprehensive 2026 CPF Rates (OW Ceiling: $8,000)...")
    async with AsyncSessionLocal() as session:
        # Tables based on latest MOM/CPF 2026 schedules
        # OW Ceiling for 2026 is $8,000. AW Ceiling is $102,000.
        
        common_ceilings = {"ow_ceiling": 8000.0, "aw_ceiling_annual": 102000.0}
        eff_date = date(2026, 1, 1)

        rates = []

        # --- SC & SPR Year 3 (Full Rates) ---
        for cat in ["SC", "SPR_Y3"]:
            rates.extend([
                {"citizenship_type": cat, "age_from": 0, "age_to": 55, "employee_rate": 0.20, "employer_rate": 0.17},
                {"citizenship_type": cat, "age_from": 55, "age_to": 60, "employee_rate": 0.18, "employer_rate": 0.16},
                {"citizenship_type": cat, "age_from": 60, "age_to": 65, "employee_rate": 0.125, "employer_rate": 0.125},
                {"citizenship_type": cat, "age_from": 65, "age_to": 70, "employee_rate": 0.075, "employer_rate": 0.09},
                {"citizenship_type": cat, "age_from": 70, "age_to": 120, "employee_rate": 0.05, "employer_rate": 0.075},
            ])

        # --- SPR Year 1 (Graduated Rates) ---
        rates.extend([
            {"citizenship_type": "SPR_Y1", "age_from": 0, "age_to": 55, "employee_rate": 0.05, "employer_rate": 0.04},
            {"citizenship_type": "SPR_Y1", "age_from": 55, "age_to": 60, "employee_rate": 0.05, "employer_rate": 0.04},
            {"citizenship_type": "SPR_Y1", "age_from": 60, "age_to": 65, "employee_rate": 0.035, "employer_rate": 0.035},
            {"citizenship_type": "SPR_Y1", "age_from": 65, "age_to": 70, "employee_rate": 0.035, "employer_rate": 0.035},
            {"citizenship_type": "SPR_Y1", "age_from": 70, "age_to": 120, "employee_rate": 0.035, "employer_rate": 0.035},
        ])

        # --- SPR Year 2 (Graduated Rates) ---
        rates.extend([
            {"citizenship_type": "SPR_Y2", "age_from": 0, "age_to": 55, "employee_rate": 0.15, "employer_rate": 0.09},
            {"citizenship_type": "SPR_Y2", "age_from": 55, "age_to": 60, "employee_rate": 0.15, "employer_rate": 0.09},
            {"citizenship_type": "SPR_Y2", "age_from": 60, "age_to": 65, "employee_rate": 0.10, "employer_rate": 0.035},
            {"citizenship_type": "SPR_Y2", "age_from": 65, "age_to": 70, "employee_rate": 0.10, "employer_rate": 0.035},
            {"citizenship_type": "SPR_Y2", "age_from": 70, "age_to": 120, "employee_rate": 0.10, "employer_rate": 0.035},
        ])

        for r_data in rates:
            # Combine common info
            full_data = {**r_data, **common_ceilings, "effective_date": eff_date, "end_date": None}
            
            # Use upsert logic or clear existing for this date
            from sqlalchemy import select, and_
            stmt = select(CPFRateConfig).where(and_(
                CPFRateConfig.citizenship_type == full_data["citizenship_type"],
                CPFRateConfig.age_from == full_data["age_from"],
                CPFRateConfig.effective_date == eff_date
            ))
            existing = (await session.execute(stmt)).scalar_one_or_none()
            
            if existing:
                # Update
                for key, val in full_data.items():
                    setattr(existing, key, val)
                print(f"Updated: {full_data['citizenship_type']} Age {full_data['age_from']}-{full_data['age_to']}")
            else:
                session.add(CPFRateConfig(**full_data))
                print(f"Added: {full_data['citizenship_type']} Age {full_data['age_from']}-{full_data['age_to']}")

        await session.commit()
        print("\nAll 2026 rates seeded successfully!")

if __name__ == "__main__":
    asyncio.run(seed_cpf_2026_comprehensive())
