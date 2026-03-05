from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError, jwt
import uuid

from app.core.security.auth import SECRET_KEY, ALGORITHM
from app.core.database import get_db
from app.models.tenant import PlatformAdmin

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/platform/auth/login")

async def get_current_platform_admin(
    token: str = Depends(oauth2_scheme), 
    db: AsyncSession = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if user_id is None or token_type != "platform_admin":
            raise credentials_exception
            
        uuid_obj = uuid.UUID(user_id)
    except (JWTError, ValueError):
        raise credentials_exception

    stmt = select(PlatformAdmin).where(PlatformAdmin.id == uuid_obj)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()

    if admin is None or not admin.is_active:
        raise credentials_exception
        
    return admin

async def get_current_super_admin(
    token: str = Depends(oauth2_scheme), 
    db: AsyncSession = Depends(get_db)
):
    """
    Validates the token, ensures it's a platform_admin type, and verifies the Super Admin role.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        
        if user_id is None or token_type != "platform_admin":
            raise credentials_exception
            
        uuid_obj = uuid.UUID(user_id)
    except (JWTError, ValueError):
        raise credentials_exception

    stmt = select(PlatformAdmin).where(PlatformAdmin.id == uuid_obj)
    result = await db.execute(stmt)
    admin = result.scalar_one_or_none()

    if admin is None or not admin.is_active:
        raise credentials_exception
        
    if admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access required")
        
    return admin
