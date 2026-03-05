from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.auth import User
from app.schemas.auth import LoginRequest, Token
from app.core.security.auth import verify_password, create_tenant_user_token
from datetime import datetime

router = APIRouter(prefix="/auth", tags=["Tenant Auth"])

@router.post("/login", response_model=Token)
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Standard login for Tenant Users (identifiable by email).
    Returns a tenant-scoped access token.
    """
    from sqlalchemy import func
    print(f"DEBUG: Login attempt for {request.email}")
    result = await db.execute(
        select(User)
        .options(selectinload(User.entity_access))
        .where(func.lower(User.email) == func.lower(request.email))
    )
    user = result.scalar_one_or_none()

    if not user:
        print(f"DEBUG: User not found: {request.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if not verify_password(request.password, user.password_hash):
        print(f"DEBUG: Password verification failed for {request.email}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is suspended",
        )

    # Update last login info
    user.last_login = datetime.utcnow()
    await db.commit()

    # Issue token with tenant context
    access_token = create_tenant_user_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
        is_admin=user.is_tenant_admin
    )
    
    # Fetch a default entity for the user to use
    from app.models.tenant import Entity
    from app.models.employment import Employment
    
    entity_result = await db.execute(
        select(Entity).where(Entity.tenant_id == user.tenant_id).limit(1)
    )
    entity = entity_result.scalar_one_or_none()
    
    # If user is linked to a person, find their active employment in this entity
    active_employment_id = None
    if user.person_id and entity:
        emp_result = await db.execute(
            select(Employment.id)
            .where(
                Employment.person_id == user.person_id,
                Employment.entity_id == entity.id,
                Employment.is_active == True
            )
            .limit(1)
        )
        active_employment_id = emp_result.scalar()

    # Prepare user response with employment_id
    user_data = {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "tenant_id": user.tenant_id,
        "is_tenant_admin": user.is_tenant_admin,
        "is_active": user.is_active,
        "two_fa_enabled": user.two_fa_enabled,
        "last_login": user.last_login,
        "created_at": user.created_at,
        "entity_access": user.entity_access,
        "person_id": user.person_id,
        "employment_id": active_employment_id,
        "display_name": user.full_name
    }
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "mfa_required": user.two_fa_enabled,
        "user": user_data
    }
