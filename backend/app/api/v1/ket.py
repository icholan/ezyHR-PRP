from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
import uuid
from app.api.v1.dependencies import get_db, get_current_active_user
from app.models import User
from app.schemas.ket import KETDashboardResponse, KETRead, KETUpdate, KETCreate
from app.services.ket import KETService

router = APIRouter(prefix="/ket", tags=["KET"], redirect_slashes=False)

@router.get("/dashboard", response_model=KETDashboardResponse)
async def get_ket_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = KETService(db)
    return await service.get_ket_dashboard(current_user.tenant_id)

@router.post("/generate", response_model=KETRead)
async def generate_ket_snapshot(
    data: KETCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = KETService(db)
    return await service.generate_ket_snapshot(data.employment_id, current_user.tenant_id)

@router.get("/{ket_id}", response_model=KETRead)
async def get_ket_detail(
    ket_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = KETService(db)
    ket = await service.get_ket_detail(ket_id)
    if not ket:
        raise HTTPException(status_code=404, detail="KET not found")
    return KETRead.from_orm(ket)

@router.patch("/{ket_id}", response_model=KETRead)
async def update_ket_status(
    ket_id: uuid.UUID,
    data: KETUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = KETService(db)
    updated = await service.update_ket_status(
        ket_id, 
        data.status, 
        signed_by=data.signed_by_employee_id
    )
    if not updated:
        raise HTTPException(status_code=404, detail="KET not found")
    return KETRead.from_orm(updated)
