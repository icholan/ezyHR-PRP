from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.v1.dependencies import require_tenant_admin
from app.services.audit import AuditService
from app.schemas.audit import AuditLogRead, SystemAuditLogRead
from typing import List, Optional
from uuid import UUID

router = APIRouter(prefix="/audit", tags=["Audit Logs"])

@router.get("/data", response_model=List[AuditLogRead])
async def get_data_audit_logs(
    table_name: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    user_id: Optional[UUID] = Query(None),
    entity_id: Optional[UUID] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100),
    current_admin=Depends(require_tenant_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve granular data change logs for the tenant.
    Only accessible by Tenant Admins.
    """
    return await AuditService.get_audit_logs(
        db=db,
        tenant_id=current_admin.tenant_id,
        entity_id=entity_id,
        user_id=user_id,
        action=action,
        table_name=table_name,
        skip=skip,
        limit=limit
    )

@router.get("/system", response_model=List[SystemAuditLogRead])
async def get_system_audit_logs(
    action: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100),
    current_admin=Depends(require_tenant_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    Retrieve high-level system event logs for the tenant.
    Only accessible by Tenant Admins.
    """
    return await AuditService.get_system_logs(
        db=db,
        tenant_id=current_admin.tenant_id,
        action=action,
        skip=skip,
        limit=limit
    )
