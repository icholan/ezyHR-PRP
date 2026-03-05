import asyncio
import os
import sys

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.tenant import PlatformAdmin
from app.core.security.auth import get_password_hash, generate_mfa_secret
from sqlalchemy import select

async def seed_super_admin():
    print("Seeding Initial Super Admin...")
    async with AsyncSessionLocal() as session:
        # Check if any admin exists
        result = await session.execute(select(PlatformAdmin))
        if result.scalar_one_or_none():
            print("Admin already exists. Skipping.")
            return

        # Create Super Admin
        mfa_secret = generate_mfa_secret()
        new_admin = PlatformAdmin(
            email="admin@yourhrms.com",
            password_hash=get_password_hash("Admin@123"),
            full_name="System Super Admin",
            role="super_admin",
            mfa_secret=mfa_secret,
            mfa_enabled=True,
            is_active=True
        )
        
        session.add(new_admin)
        await session.commit()
        
        print(f"Successfully created Super Admin!")
        print(f"Email: admin@yourhrms.com")
        print(f"Password: Admin@123")
        print(f"MFA Secret (for Authenticator App): {mfa_secret}")
        print("-" * 30)
        print("IMPORTANT: Store the MFA Secret safely!")

if __name__ == "__main__":
    asyncio.run(seed_super_admin())
