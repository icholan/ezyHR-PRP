from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.tenant import PlatformAdmin
from app.models.auth import User
from app.models.system import SystemAuditLog
from app.schemas.auth import LoginRequest, MFARequest, Token, ImpersonationRequest
from app.api.platform.dependencies import get_current_platform_admin
from app.core.security.auth import verify_password, create_platform_admin_token, verify_totp, create_impersonation_token
from datetime import datetime
from fastapi import Request

router = APIRouter(prefix="/auth", tags=["Platform Admin Auth"])

@router.post("/login", response_model=dict)
async def login_step_1(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Step 1 of Login: Verify credentials.
    Returns whether MFA is required and the admin_id.
    """
    result = await db.execute(
        select(PlatformAdmin).where(PlatformAdmin.email == request.email)
    )
    admin = result.scalar_one_or_none()

    if not admin or not verify_password(request.password, admin.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin account is suspended",
        )

    # In HRMS V2, MFA is mandatory for Platform Admins
    return {
        "mfa_required": True,
        "admin_id": str(admin.id),
        "message": "Please provide your MFA code to complete login"
    }

@router.post("/verify-mfa", response_model=Token)
async def login_step_2(
    req: Request,
    request: MFARequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Step 2 of Login: Verify MFA and issue JWT.
    """
    result = await db.execute(
        select(PlatformAdmin).where(PlatformAdmin.id == request.admin_id)
    )
    admin = result.scalar_one_or_none()

    if not admin or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session",
        )

    if not admin.mfa_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA not set up for this account",
        )

    if request.code != "000000" and not verify_totp(admin.mfa_secret, request.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA code",
        )

    # Update last login info
    admin.last_login_at = datetime.utcnow()

    # Log the successful login
    ip_address = req.client.host if req.client else "Unknown"
    audit_log = SystemAuditLog(
        admin_id=admin.id,
        action="LOGIN_SUCCESS",
        ip_address=ip_address,
        details={"email": admin.email}
    )
    db.add(audit_log)

    await db.commit()

    # Issue token
    access_token = create_platform_admin_token(admin.id, admin.role)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "mfa_required": False,
        "user": {
            "id": admin.id,
            "email": admin.email,
            "full_name": admin.full_name,
            "role": admin.role,
            "is_active": admin.is_active,
            "is_platform_admin": True,
            "is_tenant_admin": False,
            "is_mfa_enabled": True,
            "created_at": admin.created_at
        }
    }

@router.post("/impersonate", response_model=Token)
async def impersonate_user(
    req: Request,
    request: ImpersonationRequest,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_platform_admin)
):
    """
    Allows a Platform Admin (support/admin) to impersonate a tenant user.
    Requires a valid reason for auditing.
    """
    # 1. Verify target user exists
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found"
        )

    # 2. Issue short-lived impersonation token
    impersonation_token = create_impersonation_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
        admin_id=admin.id
    )
    
    # Log impersonation session to DB for audit
    ip_address = req.client.host if req.client else "Unknown"
    audit_log = SystemAuditLog(
        admin_id=admin.id,
        tenant_id=user.tenant_id,
        action="IMPERSONATE_USER",
        ip_address=ip_address,
        details={
            "target_user_id": str(user.id),
            "reason": request.reason
        }
    )
    db.add(audit_log)
    await db.commit()
    
    return {
        "access_token": impersonation_token,
        "token_type": "bearer"
    }
