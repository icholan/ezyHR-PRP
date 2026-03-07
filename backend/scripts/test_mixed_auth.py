import asyncio
import os
import sys
import uuid
from sqlalchemy import select
from jose import jwt

# Add backend to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import AsyncSessionLocal
from app.models.tenant import PlatformAdmin
from app.core.security.auth import SECRET_KEY, ALGORITHM, create_platform_admin_token
from app.api.v1.dependencies import get_current_platform_admin, get_current_any_admin

async def test_mixed_auth():
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
        print(f"Generated Token: {token[:20]}...")

        # 3. Test v1 get_current_platform_admin
        print("\n--- Testing v1 get_current_platform_admin ---")
        try:
            # We need to mock the dependency call or just call the logic
            # Since get_current_platform_admin is an async function
            authenticated_admin = await get_current_platform_admin(token=token, db=session)
            print(f"SUCCESS: Authenticated as {authenticated_admin.email}")
        except Exception as e:
            print(f"FAILED: {e}")

        # 4. Test v1 get_current_any_admin
        print("\n--- Testing v1 get_current_any_admin ---")
        try:
            authenticated = await get_current_any_admin(token=token, db=session)
            print(f"SUCCESS: Authenticated via any_admin as {getattr(authenticated, 'email', 'Unknown')}")
        except Exception as e:
            print(f"FAILED: {e}")

if __name__ == "__main__":
    asyncio.run(test_mixed_auth())
