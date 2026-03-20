import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Body, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security.permissions import Permission
from app.api.v1.dependencies import require_permission, get_current_user, has_permission_internal
from app.models.auth import User
from app.schemas.claims import ClaimCategoryCreate, ClaimCategoryRead, ClaimRequestCreate, ClaimRequestRead, ClaimRequestUpdate, ClaimStatusUpdate
from app.services.claims import ClaimsService
from app.models.employment import Employment
from sqlalchemy import select

router = APIRouter(prefix="/claims", tags=["Claims"])

# Categories
@router.post("/categories", response_model=ClaimCategoryRead)
async def create_category(
    obj_in: ClaimCategoryCreate,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_permission(Permission.MANAGE_CLAIM_CATEGORIES)),
    current_user = Depends(get_current_user)
):
    return await ClaimsService.create_category(db, obj_in, current_user.tenant_id)

@router.get("/categories", response_model=List[ClaimCategoryRead])
async def list_categories(
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Any user can list active categories for their entity to submit claims
    return await ClaimsService.list_categories(db, entity_id, current_user.tenant_id)

# Claims Submission
@router.post("", response_model=ClaimRequestRead)
async def submit_claim(
    title: str = Form(...),
    amount: float = Form(...),
    claim_date: str = Form(...),
    category_id: uuid.UUID = Form(...),
    entity_id: uuid.UUID = Form(...),
    on_behalf_of: Optional[uuid.UUID] = Form(None),
    description: Optional[str] = Form(None),
    receipts: List[UploadFile] = File([]),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    target_employment_id = None
    
    if on_behalf_of:
        # Check if user has permission to submit for team
        has_team_perm = await has_permission_internal(
            db, current_user.id, current_user.tenant_id, entity_id, Permission.SUBMIT_TEAM_CLAIM
        )
        if not has_team_perm and not current_user.is_tenant_admin:
            raise HTTPException(status_code=403, detail="Permission denied to submit claims on behalf of others")
        target_employment_id = on_behalf_of
    else:
        if not current_user.person_id:
            raise HTTPException(status_code=400, detail="User not linked to a person record")

        # Resolve employment_id for the given entity
        stmt = select(Employment.id).where(
            Employment.person_id == current_user.person_id,
            Employment.entity_id == entity_id,
            Employment.is_active == True
        )
        result = await db.execute(stmt)
        target_employment_id = result.scalar_one_or_none()
        
        if not target_employment_id:
            raise HTTPException(status_code=400, detail="User must be an employee of the selected entity to submit claims")
        
    from datetime import date
    obj_in = ClaimRequestCreate(
        title=title,
        amount=amount,
        claim_date=date.fromisoformat(claim_date),
        category_id=category_id,
        description=description
    )
    
    return await ClaimsService.submit_claim(
        db, obj_in, target_employment_id, current_user.tenant_id, receipts
    )

@router.get("/my", response_model=List[ClaimRequestRead])
async def list_my_claims(
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    if not current_user.person_id:
        return []
    
    # Resolve employment_id for the given entity
    stmt = select(Employment.id).where(
        Employment.person_id == current_user.person_id,
        Employment.entity_id == entity_id,
        Employment.is_active == True
    )
    result = await db.execute(stmt)
    employment_id = result.scalar_one_or_none()
    
    if not employment_id:
        return []

    return await ClaimsService.list_claims(db, current_user.tenant_id, employment_id=employment_id)

# Admin Approvals
@router.get("/approvals", response_model=List[ClaimRequestRead])
async def list_claims_for_approval(
    entity_id: uuid.UUID,
    status: Optional[str] = None,
    employment_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    _ = Depends(require_permission(Permission.APPROVE_CLAIM)),
    current_user = Depends(get_current_user)
):
    return await ClaimsService.list_claims(
        db, current_user.tenant_id, entity_id=entity_id, status=status, employment_id=employment_id
    )

@router.patch("/{claim_id}/status", response_model=ClaimRequestRead)
async def update_claim_status(
    claim_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Super Robust: Manually extract parameters from query or body
    # This bypasses all automatic FastAPI/Pydantic validation that might be causing 422s
    
    # 1. Try Query Parameters first
    status = request.query_params.get("status")
    rejection_reason = request.query_params.get("rejection_reason")
    
    # 2. Try JSON Body as fallback
    try:
        body = await request.json()
        if not status:
            status = body.get("status")
        if not rejection_reason:
            rejection_reason = body.get("rejection_reason")
    except Exception:
        # No body or not JSON, that's fine if we have query params
        pass

    if not status or status not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail=f"Invalid or missing status: {status}")
        
    try:
        claim_uuid = uuid.UUID(claim_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid claim ID format")

    # Manual Permission Check
    # We need the entity_id for this claim to check permissions
    from app.models.claims import ClaimRequest
    stmt = select(Employment.entity_id).join(
        ClaimRequest, ClaimRequest.employment_id == Employment.id
    ).where(ClaimRequest.id == claim_uuid)
    result = await db.execute(stmt)
    entity_id = result.scalar_one_or_none()
    
    if not entity_id:
        raise HTTPException(status_code=404, detail="Claim not found")

    if not current_user.is_tenant_admin:
        allowed = await has_permission_internal(db, current_user, entity_id, Permission.APPROVE_CLAIM)
        if not allowed:
            raise HTTPException(status_code=403, detail="Missing required permission: approve_claim")

    claim = await ClaimsService.update_claim_status(
        db, claim_uuid, status, current_user.id, rejection_reason
    )
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim
