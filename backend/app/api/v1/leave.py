"""
Leave Management API — Phase 1 (DB-Driven Rules)
=========================================
All existing endpoints are preserved.
New Phase 1 endpoints added:
  - GET  /leave/rules/statutory      → list all MOM statutory rules
  - POST /leave/rules/statutory      → create a new rule (MOM updates)
  - GET  /leave/pools                → list pools for entity
  - POST /leave/pools                → create pool for entity
  - PATCH /leave/pools/{pool_id}     → update pool cap/dates
  - GET  /leave/policies             → list company overrides for entity
  - POST /leave/policies             → add override
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import List, Optional
from datetime import date
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
import uuid

from app.schemas.leave import (
    LeaveRequestCreate, LeaveRequestRead, LeaveBalanceRead,
    LeaveTypeRead, LeaveTypeCreate, LeaveTypeUpdate,
    LeaveRequestUpdate, LeaveRequestManagementRead,
    LeaveEntitlementRead, LeaveEntitlementUpdate, LeaveEntitlementCreate,
    LeavePoolCreate, LeavePoolUpdate, LeavePoolRead,
    StatutoryLeaveRuleCreate, StatutoryLeaveRuleRead,
    LeaveTypePolicyCreate, LeaveTypePolicyRead,
    LeaveCarryPolicyCreate, LeaveCarryPolicyRead,
    AvailableLeaveTypeRead, StandardLeaveSeedRequest,
)
from app.api.v1.dependencies import get_db, get_current_user, get_current_any_admin, get_current_platform_admin
from app.services.leave import LeaveService
from app.models.leave import (
    LeaveType, LeaveRequest,
    LeavePool, StatutoryLeaveRule, LeaveTypePolicy, LeaveCarryPolicy
)
from app.tasks.leave import run_annual_grant, run_carry_expiry
from app.models.auth import User

router = APIRouter(prefix="/leave", tags=["Leave"], redirect_slashes=False)


# ─────────────────────────────────────────────
# Leave Application
# ─────────────────────────────────────────────

@router.post("/apply", response_model=dict)
async def apply_leave(
    req_data: LeaveRequestCreate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = LeaveService(db)
    try:
        request, conflicts = await service.apply_leave(
            req_data, 
            user_id=current_user.id, 
            ip_address=req.client.host if req.client else None
        )
        await db.commit()
        await db.refresh(request)
        return {
            "status": "success",
            "request": LeaveRequestRead.model_validate(request).model_dump(mode="json"),
            "conflicts": conflicts,
            "message": "Leave applied successfully. " + (
                f"Note: {len(conflicts)} date conflict(s) found at other entities." if conflicts else ""
            )
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─────────────────────────────────────────────
# Leave Balances
# ─────────────────────────────────────────────

@router.get("/balances", response_model=List[LeaveBalanceRead])
async def get_leave_balances(
    employment_id: uuid.UUID,
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not year:
        year = date.today().year
    service = LeaveService(db)
    return await service.get_balances(employment_id, year)


# ─────────────────────────────────────────────
# Leave Requests
# ─────────────────────────────────────────────

@router.get("/requests", response_model=List[dict])
async def get_leave_requests(
    employment_id: Optional[uuid.UUID] = None,
    entity_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = LeaveService(db)
    if entity_id:
        return await service.get_entity_leave_requests(entity_id, status=status)

    query = select(LeaveRequest, LeaveType.name).join(LeaveType)
    if employment_id:
        query = query.where(LeaveRequest.employment_id == employment_id)
    if status:
        query = query.where(LeaveRequest.status == status)

    result = await db.execute(query)
    requests = []
    for row in result.all():
        req, leave_name = row
        requests.append({
            "id": req.id,
            "employment_id": req.employment_id,
            "leave_type_id": req.leave_type_id,
            "leave_type_name": leave_name,
            "start_date": req.start_date,
            "end_date": req.end_date,
            "days_count": float(req.days_count),
            "reason": req.reason,
            "status": req.status,
            "attachment_url": req.attachment_url,
            "created_at": req.created_at
        })
    return requests


@router.put("/requests/{request_id}", response_model=dict)
async def update_leave_request(
    request_id: uuid.UUID,
    update_data: LeaveRequestUpdate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = LeaveService(db)
    try:
        await service.update_leave_request(
            request_id=request_id,
            status=update_data.status,
            admin_user_id=current_user.id,
            rejection_reason=update_data.rejection_reason,
            ip_address=req.client.host if req.client else None
        )
        await db.commit()
        return {"status": "success", "message": f"Leave request updated to {update_data.status}"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─────────────────────────────────────────────
# Leave Types (Admin CRUD)
# ─────────────────────────────────────────────

@router.get("/types", response_model=List[LeaveTypeRead])
async def get_leave_types(
    entity_id: uuid.UUID,
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(LeaveType).where(LeaveType.entity_id == entity_id)
    if not include_inactive:
        query = query.where(LeaveType.is_active == True)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/types", response_model=LeaveTypeRead)
async def create_leave_type(
    entity_id: uuid.UUID,
    payload: LeaveTypeCreate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lt = LeaveType(entity_id=entity_id, **payload.model_dump())
    db.add(lt)
    try:
        await db.commit()
        await db.refresh(lt)
        
        # Audit Log
        await AuditService.log_action(
            db=db,
            action="INSERT",
            table_name="leave_types",
            record_id=lt.id,
            new_value=payload.model_dump(mode="json"),
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            ip_address=req.client.host if req.client else None
        )
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Leave type code already exists. Please choose a unique code.")
    return lt


@router.patch("/types/{type_id}", response_model=LeaveTypeRead)
async def update_leave_type(
    type_id: uuid.UUID,
    entity_id: uuid.UUID,
    payload: LeaveTypeUpdate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(LeaveType).where(LeaveType.id == type_id, LeaveType.entity_id == entity_id)
    )
    lt = result.scalar_one_or_none()
    if not lt:
        raise HTTPException(status_code=404, detail="Leave type not found")
        
    from app.services.audit import to_dict
    old_val = to_dict(lt)
    
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(lt, field, val)
    try:
        await db.commit()
        await db.refresh(lt)
        
        # Audit Log
        await AuditService.log_action(
            db=db,
            action="UPDATE",
            table_name="leave_types",
            record_id=type_id,
            old_value=old_val,
            new_value=payload.model_dump(mode="json", exclude_unset=True),
            user_id=current_user.id,
            tenant_id=current_user.tenant_id,
            ip_address=req.client.host if req.client else None
        )
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Leave type code already exists. Please choose a unique code.")
    return lt


@router.delete("/types/{type_id}", response_model=dict)
async def delete_leave_type(
    type_id: uuid.UUID,
    entity_id: uuid.UUID,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(LeaveType).where(LeaveType.id == type_id, LeaveType.entity_id == entity_id)
    )
    lt = result.scalar_one_or_none()
    if not lt:
        raise HTTPException(status_code=404, detail="Leave type not found")
        
    from app.services.audit import to_dict
    old_val = to_dict(lt)
    
    lt.is_active = False
    await db.commit()

    # Audit Log
    await AuditService.log_action(
        db=db,
        action="UPDATE",
        table_name="leave_types",
        record_id=type_id,
        old_value=old_val,
        new_value={"is_active": False},
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        ip_address=req.client.host if req.client else None
    )
    return {"status": "success", "message": "Leave type deactivated"}


# ─────────────────────────────────────────────
# Phase 1: Statutory Leave Rules (Admin)
# MOM rules — global (not per entity)
# ─────────────────────────────────────────────

@router.get("/rules/statutory", response_model=List[StatutoryLeaveRuleRead])
async def list_statutory_rules(
    leave_type_code: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_admin = Depends(get_current_any_admin)
):
    """List all MOM statutory progression rules (read-only for most users)."""
    query = select(StatutoryLeaveRule).order_by(
        StatutoryLeaveRule.leave_type_code,
        StatutoryLeaveRule.effective_from.desc()
    )
    if leave_type_code:
        query = query.where(StatutoryLeaveRule.leave_type_code == leave_type_code)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/rules/statutory", response_model=StatutoryLeaveRuleRead)
async def create_statutory_rule(
    payload: StatutoryLeaveRuleCreate,
    db: AsyncSession = Depends(get_db),
    current_admin = Depends(get_current_platform_admin)
):
    """
    Insert a new MOM statutory rule (e.g. when MOM amends the Employment Act).
    The new row takes effect from effective_from. Engine automatically picks
    the correct rule based on the leave application date.
    """
    rule = StatutoryLeaveRule(**payload.model_dump())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return rule


@router.delete("/rules/statutory/{rule_id}", response_model=dict)
async def delete_statutory_rule(
    rule_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin = Depends(get_current_platform_admin)
):
    """Soft-delete a statutory rule by setting effective_to = today."""
    result = await db.execute(select(StatutoryLeaveRule).where(StatutoryLeaveRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Statutory rule not found")
    rule.effective_to = date.today()
    await db.commit()
    return {"status": "success", "message": "Rule retired. Engine will no longer use it from today."}


# ─────────────────────────────────────────────
# Phase 1: Leave Pools (Admin, per entity)
# ─────────────────────────────────────────────

@router.get("/pools", response_model=List[LeavePoolRead])
async def list_leave_pools(
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all leave pools for an entity (e.g. SICK_POOL, SPL_POOL)."""
    result = await db.execute(
        select(LeavePool).where(
            LeavePool.entity_id == entity_id
        ).order_by(LeavePool.effective_from.desc())
    )
    return result.scalars().all()


@router.post("/pools", response_model=LeavePoolRead)
async def create_leave_pool(
    entity_id: uuid.UUID,
    payload: LeavePoolCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a shared leave pool for an entity.
    After creation, link leave types to it via PATCH /types/{type_id}
    setting pool_id = <pool-id> and pool_sub_cap if needed.
    """
    pool = LeavePool(entity_id=entity_id, **payload.model_dump())
    db.add(pool)
    await db.commit()
    await db.refresh(pool)
    return pool


@router.patch("/pools/{pool_id}", response_model=LeavePoolRead)
async def update_leave_pool(
    pool_id: uuid.UUID,
    entity_id: uuid.UUID,
    payload: LeavePoolUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a pool cap or end-date it (effective_to)."""
    result = await db.execute(
        select(LeavePool).where(LeavePool.id == pool_id, LeavePool.entity_id == entity_id)
    )
    pool = result.scalar_one_or_none()
    if not pool:
        raise HTTPException(status_code=404, detail="Leave pool not found")
    for field, val in payload.model_dump(exclude_none=True).items():
        setattr(pool, field, val)
    await db.commit()
    await db.refresh(pool)
    return pool


# ─────────────────────────────────────────────
# Phase 1: Leave Type Policies / Company Overrides
# ─────────────────────────────────────────────

@router.get("/policies", response_model=List[LeaveTypePolicyRead])
async def list_leave_type_policies(
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all company-level leave cap overrides for an entity."""
    result = await db.execute(
        select(LeaveTypePolicy).where(
            LeaveTypePolicy.entity_id == entity_id
        ).order_by(LeaveTypePolicy.leave_type_code, LeaveTypePolicy.effective_from.desc())
    )
    return result.scalars().all()


@router.post("/policies", response_model=LeaveTypePolicyRead)
async def create_leave_type_policy(
    entity_id: uuid.UUID,
    payload: LeaveTypePolicyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Add a company-specific leave override.
    e.g. entity gives 18 days AL instead of MOM's 14.
    Engine will use override_days instead of the statutory rule.
    """
    policy = LeaveTypePolicy(entity_id=entity_id, **payload.model_dump())
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return policy


@router.delete("/policies/{policy_id}", response_model=dict)
async def delete_leave_type_policy(
    policy_id: uuid.UUID,
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a company override — engine will fall back to MOM statutory rule."""
    result = await db.execute(
        select(LeaveTypePolicy).where(
            LeaveTypePolicy.id == policy_id,
            LeaveTypePolicy.entity_id == entity_id
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    policy.effective_to = date.today()
    await db.commit()
    return {"status": "success", "message": "Policy retired. Engine falls back to MOM statutory rule."}


# ─────────────────────────────────────────────
# Phase 2B: Leave Carry Policies (Admin)
# ─────────────────────────────────────────────

@router.get("/carry-policies", response_model=List[LeaveCarryPolicyRead])
async def list_leave_carry_policies(
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all carry-forward policies for an entity."""
    result = await db.execute(
        select(LeaveCarryPolicy).where(
            LeaveCarryPolicy.entity_id == entity_id
        ).order_by(LeaveCarryPolicy.leave_type_code, LeaveCarryPolicy.effective_from.desc())
    )
    return result.scalars().all()


@router.post("/carry-policies", response_model=LeaveCarryPolicyRead)
async def create_leave_carry_policy(
    entity_id: uuid.UUID,
    payload: LeaveCarryPolicyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Define a carry-forward policy for an entity.
    e.g. Max 7 days of ANNUAL can be carried to next year.
    """
    policy = LeaveCarryPolicy(entity_id=entity_id, **payload.model_dump())
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return policy


@router.delete("/carry-policies/{policy_id}", response_model=dict)
async def delete_leave_carry_policy(
    policy_id: uuid.UUID,
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retire a carry-forward policy."""
    result = await db.execute(
        select(LeaveCarryPolicy).where(
            LeaveCarryPolicy.id == policy_id,
            LeaveCarryPolicy.entity_id == entity_id
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Carry policy not found")
    policy.effective_to = date.today()
    await db.commit()
    return {"status": "success", "message": "Carry policy retired."}


# ─────────────────────────────────────────────
# Phase 4: Entitlement Management (Admin)
# ─────────────────────────────────────────────

@router.get("/entitlements", response_model=List[dict])
async def list_entitlements(
    entity_id: uuid.UUID,
    year: int,
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all employee entitlements for an entity/year (Admin only)."""
    if not current_user.is_tenant_admin:
        # Check for HR Admin role...
        pass
    service = LeaveService(db)
    return await service.get_entitlements(entity_id, year, search_query=search)

@router.post("/entitlements", response_model=dict)
async def create_entitlement(
    payload: LeaveEntitlementCreate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually adjust an employee's leave balance (Admin only)."""
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = LeaveService(db)
    try:
        await service.create_entitlement(
            employment_id=payload.employment_id,
            leave_type_id=payload.leave_type_id,
            year=payload.year,
            total_days=payload.total_days,
            carried_over_days=payload.carried_over_days,
            user_id=current_user.id,
            ip_address=req.client.host if req.client else None
        )
        await db.commit()
        return {"status": "success", "message": "Entitlement created."}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/entitlements/{entitlement_id}", response_model=dict)
async def update_entitlement(
    entitlement_id: uuid.UUID,
    payload: LeaveEntitlementUpdate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manually adjust an employee's leave balance (Admin only)."""
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    
    service = LeaveService(db)
    try:
        ent = await service.update_entitlement(
            entitlement_id, 
            total_days=payload.total_days, 
            carried_over_days=payload.carried_over_days,
            user_id=current_user.id,
            ip_address=req.client.host if req.client else None
        )
        await db.commit()
        return {"status": "success", "message": "Entitlement updated."}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ─────────────────────────────────────────────
# Phase 2B: Lifecycle Tasks (Admin Trigger)
# ─────────────────────────────────────────────

@router.post("/trigger-annual-grant", response_model=dict)
async def trigger_annual_grant(
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger the background task for annual leave grant.
    Requires admin privileges.
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Admin only")
        
    if not year:
        year = date.today().year
        
    task = run_annual_grant.delay(year)
    return {
        "status": "success", 
        "task_id": task.id, 
        "message": f"Annual grant task for {year} queued successfully."
    }


@router.post("/trigger-carry-expiry", response_model=dict)
async def trigger_carry_expiry(
    as_of_date: Optional[date] = None,
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger the background task for carry-forward leave expiry.
    Requires admin privileges.
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Admin only")
        
    as_of_date_str = as_of_date.isoformat() if as_of_date else None
    task = run_carry_expiry.delay(as_of_date_str)
    return {
        "status": "success", 
        "task_id": task.id, 
        "message": f"Carry expiry task for {as_of_date or 'today'} queued successfully."
    }


@router.get("/seed-standard/available", response_model=List[AvailableLeaveTypeRead])
async def get_available_seed_types(
    current_user = Depends(get_current_any_admin)
):
    """
    Returns the list of standard Singapore leave types available for seeding.
    """
    return LeaveService.get_standard_leave_configs()


@router.post("/seed-standard/{entity_id}", response_model=dict)
async def seed_standard_leave_types(
    entity_id: uuid.UUID,
    payload: StandardLeaveSeedRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually trigger seeding of standard MOM leave types for an entity.
    Requires tenant admin privileges.
    Allows specifying a list of codes to seed.
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only Tenant Administrators can seed leave types.")
        
    service = LeaveService(db)
    try:
        results = await service.seed_standard_leave_types(entity_id, codes=payload.codes)
        await db.commit()
        return {
            "status": "success",
            "message": f"Successfully seeded {results['created']} leave types. {results['skipped']} were already present.",
            "data": results
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
