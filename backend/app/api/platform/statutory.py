from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import date
import uuid

from app.core.database import get_db
from app.models.statutory import CPFRateConfig, SHGRateConfig, SDLRateConfig, CPFAllocationConfig
from app.schemas.platform import (
    CPFRateCreate, CPFRateRead,
    SHGRateCreate, SHGRateRead,
    SDLRateCreate, SDLRateRead,
    CPFAllocationCreate, CPFAllocationRead
)
from app.api.platform.dependencies import get_current_super_admin
from app.models.tenant import PlatformAdmin

router = APIRouter(prefix="/statutory", tags=["Statutory Config"])

# --- CPF Rates ---
@router.get("/cpf", response_model=List[CPFRateRead])
async def list_cpf_rates(
    include_expired: bool = False,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    query = select(CPFRateConfig)
    if not include_expired:
        query = query.where(CPFRateConfig.is_expired == False)
    
    result = await db.execute(query.order_by(CPFRateConfig.effective_date.desc(), CPFRateConfig.age_from))
    return result.scalars().all()

@router.post("/cpf", response_model=CPFRateRead)
async def create_cpf_rate(
    payload: CPFRateCreate,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    rate = CPFRateConfig(**payload.model_dump())
    db.add(rate)
    await db.commit()
    await db.refresh(rate)
    return rate

@router.delete("/cpf/{rate_id}", response_model=dict)
async def delete_cpf_rate(
    rate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    result = await db.execute(select(CPFRateConfig).where(CPFRateConfig.id == rate_id))
    rate = result.scalar_one_or_none()
    if not rate:
        raise HTTPException(status_code=404, detail="Rate config not found")
    
    rate.is_expired = True
    await db.commit()
    return {"status": "success", "message": "Rate config marked as expired"}

# --- SHG Rates ---
@router.get("/shg", response_model=List[SHGRateRead])
async def list_shg_rates(
    include_expired: bool = False,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    query = select(SHGRateConfig)
    if not include_expired:
        query = query.where(SHGRateConfig.is_expired == False)
    
    result = await db.execute(query.order_by(SHGRateConfig.shg_type, SHGRateConfig.wage_from))
    return result.scalars().all()

@router.post("/shg", response_model=SHGRateRead)
async def create_shg_rate(
    payload: SHGRateCreate,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    rate = SHGRateConfig(**payload.model_dump())
    db.add(rate)
    await db.commit()
    await db.refresh(rate)
    return rate

@router.delete("/shg/{rate_id}", response_model=dict)
async def delete_shg_rate(
    rate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    result = await db.execute(select(SHGRateConfig).where(SHGRateConfig.id == rate_id))
    rate = result.scalar_one_or_none()
    if not rate:
        raise HTTPException(status_code=404, detail="Rate config not found")
    
    rate.is_expired = True
    await db.commit()
    return {"status": "success", "message": "SHG rate config marked as expired"}

# --- SDL Rates ---
@router.get("/sdl", response_model=List[SDLRateRead])
async def list_sdl_rates(
    include_expired: bool = False,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    query = select(SDLRateConfig)
    if not include_expired:
        query = query.where(SDLRateConfig.is_expired == False)
        
    result = await db.execute(query.order_by(SDLRateConfig.effective_date.desc()))
    return result.scalars().all()

@router.post("/sdl", response_model=SDLRateRead)
async def create_sdl_rate(
    payload: SDLRateCreate,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    rate = SDLRateConfig(**payload.model_dump())
    db.add(rate)
    await db.commit()
    await db.refresh(rate)
    return rate

@router.delete("/sdl/{rate_id}", response_model=dict)
async def delete_sdl_rate(
    rate_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    result = await db.execute(select(SDLRateConfig).where(SDLRateConfig.id == rate_id))
    rate = result.scalar_one_or_none()
    if not rate:
        raise HTTPException(status_code=404, detail="Rate config not found")
    
    rate.is_expired = True
    await db.commit()
    return {"status": "success", "message": "SDL rate config marked as expired"}

# --- CPF Allocation Config ---

@router.get("/cpf-allocations", response_model=List[CPFAllocationRead])
async def list_cpf_allocations(
    include_expired: bool = False,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    stmt = select(CPFAllocationConfig).order_by(CPFAllocationConfig.age_from)
    if not include_expired:
        stmt = stmt.where(CPFAllocationConfig.is_expired == False)
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/cpf-allocations", response_model=CPFAllocationRead)
async def create_cpf_allocation(
    payload: CPFAllocationCreate,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    # Expire existing for same age group if any
    stmt = select(CPFAllocationConfig).where(
        CPFAllocationConfig.age_from == payload.age_from,
        CPFAllocationConfig.is_expired == False
    )
    existing = (await db.execute(stmt)).scalars().all()
    for e in existing:
        e.is_expired = True
        e.end_date = payload.effective_date

    new_alloc = CPFAllocationConfig(**payload.model_dump())
    db.add(new_alloc)
    await db.commit()
    await db.refresh(new_alloc)
    return new_alloc

@router.delete("/cpf-allocations/{alloc_id}")
async def delete_cpf_allocation(
    alloc_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin: PlatformAdmin = Depends(get_current_super_admin)
):
    stmt = select(CPFAllocationConfig).where(CPFAllocationConfig.id == alloc_id)
    result = await db.execute(stmt)
    alloc = result.scalar_one_or_none()
    
    if not alloc:
        raise HTTPException(status_code=404, detail="Allocation rule not found")
    
    alloc.is_expired = True
    alloc.end_date = date.today()
    await db.commit()
    return {"message": "Allocation rule marked as expired"}
