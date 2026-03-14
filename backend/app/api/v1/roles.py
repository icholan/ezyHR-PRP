from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict
import uuid

from app.core.database import get_db
from app.models.auth import User, Role, RolePermission
from app.schemas.roles import RoleRead, RoleCreate, RoleUpdate
from app.api.v1.dependencies import require_tenant_admin
from app.services.audit import AuditService

router = APIRouter(prefix="/roles", tags=["Roles"])

@router.get("", response_model=List[RoleRead])
async def list_roles(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_tenant_admin)
):
    """
    List custom roles for the current tenant.
    """
    query = select(Role).where(Role.tenant_id == current_admin.tenant_id).offset(skip).limit(limit)
    result = await db.execute(query)
    roles = result.scalars().all()
    
    # Needs to fetch permissions and usage statistics manually
    from app.models.tenant import Entity
    from app.models.auth import UserEntityAccess, RolePermission
    from sqlalchemy import func

    roles_with_data = []
    for role in roles:
        # Fetch Permissions
        perm_query = select(RolePermission.permission).where(RolePermission.role_id == role.id)
        perm_result = await db.execute(perm_query)
        permissions = perm_result.scalars().all()
        
        # Fetch Usage Stats
        usage_query = (
            select(
                Entity.id.label("entity_id"),
                Entity.name.label("entity_name"),
                func.count(UserEntityAccess.user_id).label("user_count")
            )
            .join(UserEntityAccess, UserEntityAccess.entity_id == Entity.id)
            .where(UserEntityAccess.role_id == role.id)
            .group_by(Entity.id, Entity.name)
        )
        usage_result = await db.execute(usage_query)
        usage_stats = usage_result.all()
        
        role_data = role.__dict__.copy()
        role_data['permissions'] = permissions
        role_data['usage'] = [
            {"entity_id": row.entity_id, "entity_name": row.entity_name, "user_count": row.user_count}
            for row in usage_stats
        ]
        roles_with_data.append(role_data)
        
    return roles_with_data

@router.post("", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_in: RoleCreate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_tenant_admin)
):
    """
    Create a new custom role.
    """
    db_role = Role(
        tenant_id=current_admin.tenant_id,
        name=role_in.name,
        description=role_in.description
    )
    db.add(db_role)
    await db.commit()
    await db.refresh(db_role)
    
    # Audit Log
    await AuditService.log_action(
        db=db,
        action="INSERT",
        table_name="roles",
        record_id=db_role.id,
        new_value=role_in.model_dump(mode="json"),
        user_id=current_admin.id,
        tenant_id=current_admin.tenant_id,
        ip_address=req.client.host if req.client else None
    )
    
    for perm in role_in.permissions:
        db_perm = RolePermission(role_id=db_role.id, permission=perm)
        db.add(db_perm)
        
    await db.commit()
    
    # Return structure matching RoleRead
    role_data = db_role.__dict__.copy()
    role_data['permissions'] = role_in.permissions
    role_data['usage'] = []
    return role_data

@router.put("/{role_id}", response_model=RoleRead)
async def update_role(
    role_id: uuid.UUID,
    role_in: RoleUpdate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_tenant_admin)
):
    """
    Update a custom role and its permissions.
    """
    stmt = select(Role).where(Role.id == role_id, Role.tenant_id == current_admin.tenant_id)
    res = await db.execute(stmt)
    db_role = res.scalar_one_or_none()
    
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    from app.services.audit import to_dict
    old_val = to_dict(db_role)
        
    if role_in.name is not None:
        db_role.name = role_in.name
    if role_in.description is not None:
        db_role.description = role_in.description
        
    await db.commit()
    
    # Audit Log
    await AuditService.log_action(
        db=db,
        action="UPDATE",
        table_name="roles",
        record_id=role_id,
        old_value=old_val,
        new_value=role_in.model_dump(mode="json", exclude_unset=True),
        user_id=current_admin.id,
        tenant_id=current_admin.tenant_id,
        ip_address=req.client.host if req.client else None
    )
    
    if role_in.permissions is not None:
        # Delete old
        from sqlalchemy import delete
        del_stmt = delete(RolePermission).where(RolePermission.role_id == role_id)
        await db.execute(del_stmt)
        
        # Insert new
        for perm in role_in.permissions:
            db_perm = RolePermission(role_id=db_role.id, permission=perm)
            db.add(db_perm)
            
        await db.commit()
        
    # Read fresh permissions
    perm_query = select(RolePermission.permission).where(RolePermission.role_id == role_id)
    perm_result = await db.execute(perm_query)
    permissions = perm_result.scalars().all()
    
    role_data = db_role.__dict__.copy()
    role_data['permissions'] = permissions
    role_data['usage'] = [] # Simplified for update response
    return role_data

@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: uuid.UUID,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_tenant_admin)
):
    """
    Delete a custom role.
    """
    stmt = select(Role).where(Role.id == role_id, Role.tenant_id == current_admin.tenant_id)
    res = await db.execute(stmt)
    db_role = res.scalar_one_or_none()
    
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
        
    from app.services.audit import to_dict
    old_val = to_dict(db_role)
        
    # Assume cascade delete on RolePermission
    await db.delete(db_role)
    await db.commit()

    # Audit Log
    await AuditService.log_action(
        db=db,
        action="DELETE",
        table_name="roles",
        old_value=old_val,
        record_id=role_id,
        user_id=current_admin.id,
        tenant_id=current_admin.tenant_id,
        ip_address=req.client.host if req.client else None
    )
