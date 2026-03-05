from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.dependencies import get_db, get_current_user
from app.schemas.reporting import ReportRequest, ReportResponse, ReportType
from app.services.reporting import ReportingService
from app.models import User

router = APIRouter(prefix="/reporting", tags=["Reporting"])

@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    request: ReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # RBAC check: Only Admins can generate statutory reports
    if not current_user.is_tenant_admin:
        # Check if user is HR Admin for this entity
        from app.api.v1.dependencies import get_entity_access
        role = await get_entity_access(request.entity_id, current_user, db)
        if role != "hr_admin":
            raise HTTPException(status_code=403, detail="Not enough permissions")

    service = ReportingService(db)
    
    if request.report_type == ReportType.CPF91:
        if not request.month:
            raise HTTPException(status_code=400, detail="Month is required for CPF91")
        content = await service.generate_cpf91_report(request.entity_id, request.year, request.month)
        file_ext = "txt"
    elif request.report_type == ReportType.IR8A:
        content = await service.generate_ir8a_report(request.entity_id, request.year)
        file_ext = "xml"
    elif request.report_type == ReportType.LEAVE_HISTORY:
        content = await service.generate_leave_history_report(request.entity_id, request.year)
        file_ext = "csv"
    else:
        raise HTTPException(status_code=501, detail="Report type not yet implemented")

    if not content:
        raise HTTPException(status_code=404, detail="No payroll data found for this period")
    
    # In a real app, upload to S3. For demo, we provide a parameterized link
    download_url = f"/api/v1/reporting/download?type={request.report_type.value}&entity_id={request.entity_id}&year={request.year}"
    if request.month:
        download_url += f"&month={request.month}"

    return ReportResponse(
        file_name=f"{request.report_type.value}_{request.year}{request.month or ''}.{file_ext}",
        download_url=download_url,
        generated_at=datetime.utcnow().isoformat(),
        metadata={"status": "ready"}
    )

@router.get("/download")
async def download_report(
    type: ReportType,
    entity_id: str,
    year: int,
    month: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ReportingService(db)
    if type == ReportType.CPF91:
        if not month:
            raise HTTPException(status_code=400, detail="Month required for CPF91")
        content = await service.generate_cpf91_report(entity_id, year, month)
        media_type = "text/plain"
        filename = f"CPF91_{year}{month:02d}.txt"
    elif type == ReportType.IR8A:
        content = await service.generate_ir8a_report(entity_id, year)
        media_type = "application/xml"
        filename = f"IR8A_{year}.xml"
    elif type == ReportType.LEAVE_HISTORY:
        content = await service.generate_leave_history_report(entity_id, year)
        media_type = "text/csv"
        filename = f"LeaveHistory_{year}.csv"

    if not content:
        raise HTTPException(status_code=404)

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
