from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.auth import User, UserEntityAccess, Role, RolePermission
from app.core.security.auth import SECRET_KEY, ALGORITHM
from app.schemas.auth import TokenData
import uuid

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="v1/auth/login")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Verifies the JWT and ensures it is of type 'tenant_user'.
    Injects the user object which contains the tenant_id.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        tenant_id: str = payload.get("tenant_id")
        
        if user_id is None or tenant_id is None:
            raise credentials_exception
            
        if token_type not in ["tenant_user", "impersonation"]:
            raise credentials_exception
            
        token_data = TokenData(user_id=user_id, type=token_type)
        # Store impersonator ID in request state if needed for auditing
        impersonated_by = payload.get("impersonated_by")
    except JWTError:
        raise credentials_exception

    result = await db.execute(
        select(User).where(User.id == token_data.user_id)
    )
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception
        
    return user

get_current_active_user = get_current_user

def require_tenant_admin(user: User = Depends(get_current_user)):
    """
    Constraint for Tenant Admins (HR Admins/Owners).
    Bypasses individual entity-level checks.
    """
    if not user.is_tenant_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Restricted to Tenant Admins only"
        )
    return user

async def get_entity_access(
    entity_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> uuid.UUID:
    """
    Verifies if a user has access to a specific entity.
    Returns the role_id.
    """
    # Tenant Admins have global access
    if user.is_tenant_admin:
        # For legacy compatibility, return a "fake" UUID or None, but ideally callers
        # use require_permission instead of checking roles directly.
        return None

    result = await db.execute(
        select(UserEntityAccess).where(
            UserEntityAccess.user_id == user.id,
            UserEntityAccess.entity_id == entity_id
        )
    )
    access = result.scalar_one_or_none()
    
    if not access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this entity"
        )
        
    return access.role_id

def require_permission(required_permission: str):
    async def permission_checker(
        entity_id: uuid.UUID,
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ):
        # 1. Tenant Admins have all permissions everywhere
        if user.is_tenant_admin:
            return True

        # 2. Join UserEntityAccess -> Role -> RolePermission
        query = select(RolePermission).join(
            Role, Role.id == RolePermission.role_id
        ).join(
            UserEntityAccess, UserEntityAccess.role_id == Role.id
        ).where(
            UserEntityAccess.user_id == user.id,
            UserEntityAccess.entity_id == entity_id,
            RolePermission.permission == required_permission
        )
        
        result = await db.execute(query)
        has_permission = result.scalar_one_or_none()
        
        if not has_permission:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail=f"Missing required permission: {required_permission}"
            )
            
        return True
        
    return permission_checker
