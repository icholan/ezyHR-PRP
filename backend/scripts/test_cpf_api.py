import asyncio
import os
import sys
import uuid
import requests
from sqlalchemy import select

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import AsyncSessionLocal
from app.models.tenant import PlatformAdmin
from app.core.security.auth import create_platform_admin_token

BASE_URL = "http://localhost:8000"

async def test_cpf_api():
    print("--- Testing CPF Rate Configuration API (Bypassing MFA) ---")
    
    async with AsyncSessionLocal() as session:
        # 1. Find a platform admin
        result = await session.execute(select(PlatformAdmin).limit(1))
        admin = result.scalar_one_or_none()
        
        if not admin:
            print("No Platform Admin found. Please run seed_admin.py first.")
            return

        print(f"Found Admin: {admin.email} (ID: {admin.id}, Role: {admin.role})")
        
        # 2. Create token
        token = create_platform_admin_token(admin.id, admin.role)
        headers = {"Authorization": f"Bearer {token}"}

    # 3. List Rates
    print("Listing CPF rates via API...")
    resp = requests.get(f"{BASE_URL}/platform/statutory/cpf", headers=headers)
    if resp.status_code == 200:
        rates = resp.json()
        print(f"SUCCESS: Found {len(rates)} rate brackets.")
    else:
        print(f"FAILED: Could not list rates. Status: {resp.status_code}")
        print(resp.text)
        return

    # 4. Create a Rate
    print("Adding a test rate bracket...")
    new_rate = {
        "citizenship_type": "SC",
        "age_from": 35,
        "age_to": 45,
        "employee_rate": 0.20,
        "employer_rate": 0.17,
        "ow_ceiling": 6800.0,
        "aw_ceiling_annual": 102000.0,
        "effective_date": "2024-01-01"
    }
    resp = requests.post(f"{BASE_URL}/platform/statutory/cpf", json=new_rate, headers=headers)
    if resp.status_code == 200:
        created_rate = resp.json()
        print(f"SUCCESS: Created rate with ID: {created_rate['id']}")
        rate_id = created_rate['id']
    else:
        print(f"FAILED: Could not create rate. Status: {resp.status_code}")
        print(resp.text)
        return

    # 5. Delete the Rate
    print(f"Deleting test rate {rate_id}...")
    resp = requests.delete(f"{BASE_URL}/platform/statutory/cpf/{rate_id}", headers=headers)
    if resp.status_code == 200:
        print("SUCCESS: Deleted test rate.")
    else:
        print(f"FAILED: Could not delete rate. Status: {resp.status_code}")

if __name__ == "__main__":
    asyncio.run(test_cpf_api())
