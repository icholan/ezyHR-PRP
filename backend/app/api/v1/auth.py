from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.models.auth import User
from app.models.tenant import Tenant
from app.schemas.auth import LoginRequest, Token, TenantSignupRequest
from app.core.security.auth import verify_password, create_tenant_user_token
from app.api.v1.dependencies import get_current_active_user
from datetime import datetime
from app.services.audit import AuditService
from app.services.tenant_provisioning import TenantProvisioningService

router = APIRouter(prefix="/auth", tags=["Tenant Auth"])

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(
    request: TenantSignupRequest,
    req: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Public endpoint to provision a new SaaS Tenant.
    """
    # Check if email exists
    result = await db.execute(select(User).where(func.lower(User.email) == func.lower(request.admin_email)))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        service = TenantProvisioningService(db)
        provision_result = await service.provision_new_tenant(
            company_name=request.company_name,
            admin_name=request.admin_full_name,
            admin_email=request.admin_email,
            password=request.admin_password
        )
        # We don't log the system event yet because the tenant is just created and setup isn't complete.
        # Alternatively, we could log: "TENANT_CREATED".
        return {
            "message": "Tenant successfully created.",
            "data": provision_result
        }
    except Exception as e:
        print(f"Provisioning error: {e}")
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to provision tenant")

@router.post("/login", response_model=Token)
async def login(
    request: LoginRequest,
    req: Request,
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
    
    # Fetch a default entity and tenant info for the user to use
    from app.models.tenant import Entity, Tenant
    from app.models.employment import Employment
    
    entity_result = await db.execute(
        select(Entity).where(Entity.tenant_id == user.tenant_id).limit(1)
    )
    entity = entity_result.scalar_one_or_none()
    
    tenant_result = await db.execute(
        select(Tenant.setup_complete).where(Tenant.id == user.tenant_id)
    )
    setup_complete = tenant_result.scalar() or False
    
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
        "setup_complete": setup_complete,
        "is_active": user.is_active,
        "two_fa_enabled": user.two_fa_enabled,
        "last_login": user.last_login,
        "created_at": user.created_at,
        "entity_access": user.entity_access,
        "person_id": user.person_id,
        "employment_id": active_employment_id,
        "selected_entity_id": entity.id if entity else None,
        "display_name": user.full_name
    }
    
    # Log the successful login
    await AuditService.log_system_event(
        db=db,
        action="LOGIN",
        user_id=user.id,
        tenant_id=user.tenant_id,
        ip_address=req.client.host if req.client else None,
        details={"email": user.email, "display_name": user.full_name}
    )
    
    await db.commit()
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "mfa_required": user.two_fa_enabled,
        "user": user_data
    }

@router.post("/logout")
async def logout(
    req: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Logs out the user and records the event in the system audit log.
    Client is responsible for clearing its local token.
    """
    await AuditService.log_system_event(
        db=db,
        action="LOGOUT",
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        ip_address=req.client.host if req.client else None,
        details={"email": current_user.email, "display_name": current_user.full_name}
    )
    
    await db.commit()
    
    return {"message": "Logged out successfully"}

@router.post("/complete-onboarding")
async def complete_onboarding(
    req: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Marks the tenant setup as complete, escaping the Onboarding Wizard.
    Only permitted for Tenant Admins.
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only Tenant Admins can complete setup.")

    result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    tenant.setup_complete = True
    
    await AuditService.log_system_event(
        db=db,
        action="ONBOARDING_COMPLETED",
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        ip_address=req.client.host if req.client else None,
        details={"tenant_name": tenant.name}
    )
    
    await db.commit()
    
    return {"message": "Onboarding complete"}
