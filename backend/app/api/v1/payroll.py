from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime
from app.core.database import get_db
from app.api.v1.dependencies import get_current_user, require_tenant_admin, get_entity_access
from app.models.payroll import PayrollRun, PayrollRecord, PersonCPFSummary
from app.models.auth import User
from app.schemas.payroll import (
    PayrollRunCreate, PayrollRunResponse, PayrollRunDetail,
    PayrollRecordResponse,
    PersonCPFSummaryResponse, PersonCPFSummaryUpdate
)
from app.services.payroll import payroll_service
from app.services.reporting import ReportingService
from app.services.ai_audit import ai_audit_service
from fastapi.responses import Response
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

    # Fetch records with detailed info
    from app.models.employment import Employment, Person
    from app.models.tenant import Entity

    rec_result = await db.execute(
        select(
            PayrollRecord,
            Person.full_name.label("employee_name"),
            Employment.employee_code.label("employee_code"),
            Entity.name.label("entity_name"),
            Entity.uen.label("entity_uen")
        )
        .join(Employment, PayrollRecord.employment_id == Employment.id)
        .join(Person, Employment.person_id == Person.id)
        .join(Entity, PayrollRecord.entity_id == Entity.id)
        .where(PayrollRecord.payroll_run_id == run_id)
    )
    
    records = []
    for row in rec_result:
        rec = row.PayrollRecord
        rec.employee_name = row.employee_name
        rec.employee_code = row.employee_code
        rec.entity_name = row.entity_name
        rec.entity_uen = row.entity_uen
        records.append(rec)
    
    run.records = records
    
    return run

@router.delete("/runs/{run_id}")
async def delete_payroll_run(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Hard deletes a payroll run. 
    Requires HR Admin access.
    """
    result = await db.execute(select(PayrollRun).where(PayrollRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
        
    # Verify entity access (Admin check handled inside)
    role = await get_entity_access(run.entity_id, user, db)
    if role != "hr_admin":
        raise HTTPException(status_code=403, detail="Only HR Admins can delete runs")

    await payroll_service.delete_payroll_run(db, run_id)
    return {"message": "Payroll run deleted successfully"}

@router.get("/records/{record_id}", response_model=PayrollRecordResponse)
async def get_payroll_record(
    record_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Fetches a single payroll record for payslip viewing with detailed info.
    """
    from app.models.employment import Employment, Person
    from app.models.tenant import Entity

    stmt = select(
        PayrollRecord,
        Person.full_name.label("employee_name"),
        Employment.employee_code.label("employee_code"),
        Entity.name.label("entity_name"),
        Entity.uen.label("entity_uen")
    ).join(
        Employment, PayrollRecord.employment_id == Employment.id
    ).join(
        Person, Employment.person_id == Person.id
    ).join(
        Entity, PayrollRecord.entity_id == Entity.id
    ).where(
        PayrollRecord.id == record_id
    )

    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Payroll record not found")
        
    record = row.PayrollRecord
    record.employee_name = row.employee_name
    record.employee_code = row.employee_code
    record.entity_name = row.entity_name
    record.entity_uen = row.entity_uen
    
    # Verify entity access
    await get_entity_access(record.entity_id, user, db)
    
    return record

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

# --- Person YTD Management ---

@router.get("/ytd/{person_id}", response_model=List[PersonCPFSummaryResponse])
async def get_person_ytd(
    person_id: uuid.UUID,
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Fetches the YTD CPF summary for a person.
    """
    await get_entity_access(None, user, db) # Basic verification
    
    stmt = select(PersonCPFSummary).where(PersonCPFSummary.person_id == person_id)
    if year:
        stmt = stmt.where(PersonCPFSummary.year == year)
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.put("/ytd/{person_id}", response_model=PersonCPFSummaryResponse)
async def update_person_ytd(
    person_id: uuid.UUID,
    payload: PersonCPFSummaryUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Manually updates or initializes YTD totals for a person.
    Useful for system migration mid-year.
    """
    if not user.is_tenant_admin:
         raise HTTPException(status_code=403, detail="Only Tenant Admins can manually adjust YTD")
         
    stmt = select(PersonCPFSummary).where(
        PersonCPFSummary.person_id == person_id,
        PersonCPFSummary.year == payload.year
    )
    summary = (await db.execute(stmt)).scalar_one_or_none()
    
    if not summary:
        summary = PersonCPFSummary(person_id=person_id, **payload.model_dump())
        db.add(summary)
    else:
        for key, value in payload.model_dump().items():
            setattr(summary, key, value)
            
    await db.commit()
    await db.refresh(summary)
    return summary

# --- Statutory Exports ---

@router.get("/runs/{run_id}/export/cpf91")
async def export_cpf91(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Generates and downloads the CPF91 (EZPay) file for an approved run.
    """
    result = await db.execute(select(PayrollRun).where(PayrollRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    await get_entity_access(run.entity_id, user, db)
    
    # Must be approved to export statutory files
    if run.status != "approved":
        raise HTTPException(status_code=400, detail="Payroll run must be approved before export")

    reporting_service = ReportingService(db)
    file_content = await reporting_service.generate_cpf91_report(
        str(run.entity_id), run.period.year, run.period.month
    )
    
    if not file_content:
        raise HTTPException(status_code=404, detail="No payroll data found for this run")

    filename = f"CPF91_{run.period.strftime('%Y%m')}_{run.id.hex[:6]}.txt"
    return Response(
        content=file_content,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/runs/{run_id}/export/giro")
async def export_giro(
    run_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    Generates and downloads the GIRO (CSV) file for an approved run.
    """
    result = await db.execute(select(PayrollRun).where(PayrollRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    await get_entity_access(run.entity_id, user, db)
    
    if run.status != "approved":
        raise HTTPException(status_code=400, detail="Payroll run must be approved before export")

    reporting_service = ReportingService(db)
    file_content = await reporting_service.generate_giro_report(
        str(run.entity_id), run.period.year, run.period.month
    )
    
    if not file_content:
        raise HTTPException(status_code=404, detail="No payroll data found for this run")

    filename = f"GIRO_{run.period.strftime('%Y%m')}_{run.id.hex[:6]}.csv"
    return Response(
        content=file_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
