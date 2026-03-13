import asyncio
import os
import sys

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.auth import User
from app.core.security.auth import get_password_hash
from sqlalchemy import select

async def reset_password():
    async with AsyncSessionLocal() as session:
        email = "yal@yal.com"
        new_password = "Pass@123"
        hashed_pw = get_password_hash(new_password)
        
        stmt = select(User).where(User.email == email)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if user:
            user.password_hash = hashed_pw
            await session.commit()
            print(f"✅ Successfully reset password for {email} to {new_password}")
        else:
            print(f"❌ Could not find user with email {email}")

if __name__ == "__main__":
    asyncio.run(reset_password())
