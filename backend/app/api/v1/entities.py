from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from app.core.database import get_db
from app.models.tenant import Entity
from app.models.auth import User
from app.api.v1.dependencies import get_current_user
from app.schemas.entities import EntityRead, EntityCreate, EntityUpdate
from datetime import datetime
from app.services.leave import LeaveService
from app.services.audit import AuditService

router = APIRouter(prefix="/entities", tags=["Entities"])

@router.get("", response_model=List[EntityRead])
async def list_entities(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List active entities belonging to the current tenant.
    """
    # Tenant Admins can see all entities. Regular users can only see what they have access to.
    if current_user.is_tenant_admin:
        query = select(Entity).where(Entity.tenant_id == current_user.tenant_id, Entity.is_active == True).offset(skip).limit(limit)
    else:
        from app.models.auth import UserEntityAccess
        query = (
            select(Entity)
            .join(UserEntityAccess, UserEntityAccess.entity_id == Entity.id)
            .where(
                Entity.tenant_id == current_user.tenant_id,
                Entity.is_active == True,
                UserEntityAccess.user_id == current_user.id
            )
            .offset(skip)
            .limit(limit)
        )
        
    result = await db.execute(query)
    return result.scalars().all()

@router.post("", response_model=EntityRead, status_code=status.HTTP_201_CREATED)
async def create_entity(
    entity_in: EntityCreate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new entity for the current tenant.
    Only Tenant Admins can do this.
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only Tenant Administrators can create entities.")
        
    db_entity = Entity(
        tenant_id=current_user.tenant_id,
        **entity_in.model_dump()
    )
    db.add(db_entity)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        # Handle unique constraint violations gracefully
        error_msg = str(e).lower()
        if "unique" in error_msg:
            if "uen" in error_msg:
                raise HTTPException(status_code=400, detail="Company UEN already exists.")
            if "cpf_account_no" in error_msg:
                raise HTTPException(status_code=400, detail="CPF Account No already exists.")
            if "iras_tax_ref" in error_msg:
                raise HTTPException(status_code=400, detail="IRAS Tax Reference already exists.")
            if "gst_no" in error_msg:
                raise HTTPException(status_code=400, detail="GST Registration No already exists.")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    await db.refresh(db_entity)

    # Audit Log
    await AuditService.log_action(
        db=db,
        action="INSERT",
        table_name="entities",
        record_id=db_entity.id,
        new_value=entity_in.model_dump(mode="json"),
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        ip_address=req.client.host if req.client else None
    )
    
    # Auto-seed standard leave types for the new entity
    try:
        leave_service = LeaveService(db)
        await leave_service.seed_standard_leave_types(entity_id=db_entity.id)
        await db.commit() 
    except Exception as e:
        print(f"Failed to auto-seed leave types for entity {db_entity.id}: {e}")
        
    return db_entity

@router.patch("/{entity_id}", response_model=EntityRead)
async def update_entity(
    entity_id: uuid.UUID,
    entity_in: EntityUpdate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an existing entity.
    Only Tenant Admins can do this.
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only Tenant Administrators can update entities.")
        
    query = select(Entity).where(Entity.id == entity_id, Entity.tenant_id == current_user.tenant_id)
    result = await db.execute(query)
    db_entity = result.scalar_one_or_none()
    
    if not db_entity:
        raise HTTPException(status_code=404, detail="Entity not found")
        
    from app.services.audit import to_dict
    old_val = to_dict(db_entity)
    
    update_data = entity_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_entity, field, value)
        
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        error_msg = str(e).lower()
        if "unique" in error_msg:
            if "uen" in error_msg:
                raise HTTPException(status_code=400, detail="Company UEN already exists.")
            if "cpf_account_no" in error_msg:
                raise HTTPException(status_code=400, detail="CPF Account No already exists.")
            if "iras_tax_ref" in error_msg:
                raise HTTPException(status_code=400, detail="IRAS Tax Reference already exists.")
            if "gst_no" in error_msg:
                raise HTTPException(status_code=400, detail="GST Registration No already exists.")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    await db.refresh(db_entity)

    # Audit Log
    await AuditService.log_action(
        db=db,
        action="UPDATE",
        table_name="entities",
        record_id=entity_id,
        old_value=old_val,
        new_value=entity_in.model_dump(mode="json", exclude_unset=True),
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        ip_address=req.client.host if req.client else None
    )

    return db_entity

@router.delete("/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entity(
    entity_id: uuid.UUID,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Soft-delete an entity (mark as inactive).
    Only Tenant Admins can do this.
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only Tenant Administrators can delete entities.")
        
    query = select(Entity).where(Entity.id == entity_id, Entity.tenant_id == current_user.tenant_id)
    result = await db.execute(query)
    db_entity = result.scalar_one_or_none()
    
    if not db_entity:
        raise HTTPException(status_code=404, detail="Entity not found")
        
    from app.services.audit import to_dict
    old_val = to_dict(db_entity)
    
    db_entity.is_active = False
    await db.commit()

    # Audit Log
    await AuditService.log_action(
        db=db,
        action="UPDATE",
        table_name="entities",
        record_id=entity_id,
        old_value=old_val,
        new_value={"is_active": False},
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        ip_address=req.client.host if req.client else None
    )
