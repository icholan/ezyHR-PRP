import asyncio
import os
import sys
import uuid
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.security.auth import create_access_token
from app.core.database import AsyncSessionLocal
from app.models.auth import User
from app.models.employment import Employment, Person
from sqlalchemy import select
from datetime import timedelta

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User).where(User.email == 'alexa@alexa.com').limit(1))
        user = result.scalar_one_or_none()
        if user:
            token = create_access_token(
                data={"sub": str(user.id), "tenant_id": str(user.tenant_id), "is_admin": user.is_tenant_admin, "type": "tenant_user"},
                expires_delta=timedelta(minutes=60)
            )
            print(f"TOKEN={token}")
            
            # get a valid user employment id
            stmt = select(Employment, Person).join(Person, Employment.person_id == Person.id).where(Person.tenant_id == user.tenant_id).limit(1)
            emp = await session.execute(stmt)
            row = emp.first()
            if row:
                e, p = row
                print(f"EMP_ID={e.id}")
            
asyncio.run(main())
