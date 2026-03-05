from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from typing import List
from datetime import datetime, date
import uuid

from app.core.database import get_db
from app.models.tenant import Tenant, PlatformAdmin
from app.models.system import SystemAuditLog
from app.schemas.platform import TenantRead, TenantStats, TenantUpdate, SubscriptionUpdate
from app.api.platform.dependencies import get_current_super_admin
from fastapi import Request

router = APIRouter(prefix="/admin", tags=["Platform Admin"])

@router.get("/tenants", response_model=List[TenantRead])
async def list_tenants(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    """
    List all SaaS tenants. Only accessible by platform super_admins.
    """
    query = select(Tenant).order_by(Tenant.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/stats", response_model=TenantStats)
async def get_platform_stats(
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    """
    Get aggregated statistics for the platform dashboard.
    """
    # Total Tenants
    total_res = await db.execute(select(func.count()).select_from(Tenant))
    total_tenants = total_res.scalar_one()

    # Active Tenants
    active_res = await db.execute(select(func.count()).where(Tenant.is_active == True))
    active_tenants = active_res.scalar_one()

    # Total MRR
    mrr_res = await db.execute(select(func.sum(Tenant.mrr)))
    total_mrr = mrr_res.scalar_one_or_none()

    # New this month
    this_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_stmt = select(func.count()).where(Tenant.created_at >= this_month)
    new_res = await db.execute(new_stmt)
    new_count = new_res.scalar_one()

    return TenantStats(
        total_tenants=total_tenants or 0,
        active_tenants=active_tenants or 0,
        total_mrr=float(total_mrr or 0.0),
        new_this_month=new_count or 0
    )

@router.patch("/tenants/{tenant_id}/suspend", response_model=TenantRead)
async def suspend_tenant(
    req: Request,
    tenant_id: uuid.UUID,
    reason: str,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    """
    Suspends a tenant, locking out all its users.
    """
    stmt = select(Tenant).where(Tenant.id == tenant_id)
    result = await db.execute(stmt)
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    tenant.is_active = False
    tenant.suspended_at = datetime.utcnow()
    tenant.suspended_reason = reason
    tenant.suspended_by = admin.id
    
    # Audit logging
    ip_address = req.client.host if req.client else "Unknown"
    audit_log = SystemAuditLog(
        admin_id=admin.id,
        tenant_id=tenant.id,
        action="SUSPEND_TENANT",
        ip_address=ip_address,
        details={"reason": reason}
    )
    db.add(audit_log)

    await db.commit()
    await db.refresh(tenant)
    return tenant

@router.get("/tenants/{tenant_id}", response_model=TenantRead)
async def get_tenant(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    """
    Get tenant details.
    """
    stmt = select(Tenant).where(Tenant.id == tenant_id)
    result = await db.execute(stmt)
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.patch("/tenants/{tenant_id}", response_model=TenantRead)
async def update_tenant(
    req: Request,
    tenant_id: uuid.UUID,
    tenant_in: TenantUpdate,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    """
    Update tenant details.
    """
    stmt = select(Tenant).where(Tenant.id == tenant_id)
    result = await db.execute(stmt)
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    update_data = tenant_in.model_dump(exclude_unset=True)
    if not update_data:
        return tenant
        
    for field, value in update_data.items():
        setattr(tenant, field, value)
        
    # Audit logging
    ip_address = req.client.host if req.client else "Unknown"
    audit_log = SystemAuditLog(
        admin_id=admin.id,
        tenant_id=tenant.id,
        action="UPDATE_TENANT",
        ip_address=ip_address,
        details={"updates": update_data}
    )
    db.add(audit_log)

    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.get("/subscriptions", response_model=List[TenantRead])
async def list_subscriptions(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    """
    List all tenant subscriptions ordered by MRR.
    """
    query = select(Tenant).order_by(Tenant.mrr.desc().nullslast()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.patch("/subscriptions/{tenant_id}", response_model=TenantRead)
async def update_subscription(
    req: Request,
    tenant_id: uuid.UUID,
    sub_in: SubscriptionUpdate,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    """
    Update tenant subscription plan/MRR.
    """
    stmt = select(Tenant).where(Tenant.id == tenant_id)
    result = await db.execute(stmt)
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    update_data = sub_in.model_dump(exclude_unset=True)
    if not update_data:
        return tenant
        
    for field, value in update_data.items():
        setattr(tenant, field, value)
        
    # Audit logging
    ip_address = req.client.host if req.client else "Unknown"
    audit_log = SystemAuditLog(
        admin_id=admin.id,
        tenant_id=tenant.id,
        action="UPDATE_SUBSCRIPTION",
        ip_address=ip_address,
        details={"updates": update_data}
    )
    db.add(audit_log)

    await db.commit()
    await db.refresh(tenant)
    return tenant
