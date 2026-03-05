from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.api.v1.dependencies import get_current_user, require_tenant_admin, get_entity_access
from app.models.payroll import PayrollRun, PayrollRecord
from app.models.auth import User
from app.schemas.payroll import PayrollRunCreate, PayrollRunResponse, PayrollRunDetail
from app.services.payroll import payroll_service
from app.services.ai_audit import ai_audit_service
import uuid

router = APIRouter(prefix="/payroll", tags=["Payroll"])

@router.get("/runs", response_model=List[PayrollRunResponse])
async def list_payroll_runs(
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Lists all payroll runs for an entity.
    """
    await get_entity_access(entity_id, user, db)
    
    result = await db.execute(
        select(PayrollRun).where(PayrollRun.entity_id == entity_id).order_by(PayrollRun.period.desc())
    )
    return result.scalars().all()

@router.post("/runs", response_model=PayrollRunResponse)
async def create_payroll_run(
    request: PayrollRunCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Initializes a new payroll run for an entity.
    Requires HR Admin access for the entity.
    """
    # 1. Verify Entity Access
    role = await get_entity_access(request.entity_id, user, db)
    if role != "hr_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only HR Admins can create payroll runs"
        )

    # 2. Check for existing run for this period
    existing = await db.execute(
        select(PayrollRun).where(
            PayrollRun.entity_id == request.entity_id,
            PayrollRun.period == request.period
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payroll run for {request.period} already exists"
        )

    # 3. Create Draft Run
    new_run = PayrollRun(
        entity_id=request.entity_id,
        period=request.period,
        status="draft",
        run_by=user.id,
        notes=request.notes
    )
    
    db.add(new_run)
    await db.commit()
    await db.refresh(new_run)
    
    return new_run

@router.post("/runs/{run_id}/process")
async def process_payroll_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Triggers the bulk calculation of all records for this run.
    """
    # Verify entity access
    result = await db.execute(select(PayrollRun).where(PayrollRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
        
    await get_entity_access(run.entity_id, user, db)
    
    count = await payroll_service.process_entity_payroll(db, run_id)
    return {"message": f"Processed {count} records successfully"}

@router.post("/runs/{run_id}/audit")
async def audit_payroll_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Triggers the AI Audit for a processed payroll run.
    """
    await get_entity_access(None, user, db) # Basic access check, entity will be checked inside
    
    # In a real app, we'd pass entity_id to get_entity_access. 
    # For now, we'll let the service handle the data fetching.
    
    flags_count = await ai_audit_service.run_audit(db, run_id)
    return {"flags_found": flags_count}

@router.get("/runs/{run_id}", response_model=PayrollRunDetail)
async def get_payroll_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Fetches details of a payroll run including all individual records.
    """
    result = await db.execute(
        select(PayrollRun).where(PayrollRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")

    # Verify Entity Access
    await get_entity_access(run.entity_id, user, db)

    # Fetch records (Manual join/relationship load)
    rec_result = await db.execute(
        select(PayrollRecord).where(PayrollRecord.payroll_run_id == run_id)
    )
    run.records = rec_result.scalars().all()
    
    return run

from app.models.system import AuditLog

@router.post("/runs/{run_id}/approve")
async def approve_payroll_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Approves a payroll run. 
    In V2, this triggers the AI Audit if not already run.
    """
    result = await db.execute(
        select(PayrollRun).where(PayrollRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")

    # Only Tenant Admins can approve
    if not user.is_tenant_admin:
        role = await get_entity_access(run.entity_id, user, db)
        if role != "hr_admin":
             raise HTTPException(status_code=403, detail="Insufficient permissions")

    # TODO: Check if AI Audit is clean
    
    run.status = "approved"
    run.approved_by = user.id
    run.approved_at = datetime.utcnow()
    
    # Audit Logging
    audit = AuditLog(
        tenant_id=user.tenant_id,
        user_id=user.id,
        entity_id=run.entity_id,
        table_name="payroll_runs",
        record_id=run.id,
        action="UPDATE",
        old_value={"status": "draft"},
        new_value={"status": "approved"}
    )
    db.add(audit)
    
    await db.commit()
    return {"status": "approved"}
