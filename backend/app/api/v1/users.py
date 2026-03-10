from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
import logging

from app.core.database import get_db
from app.models.auth import User, UserEntityAccess
from app.schemas.users import UserRead, UserCreate, UserUpdate, UserList
from app.api.v1.dependencies import get_current_user, get_db
from app.services.audit import AuditService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("", response_model=UserList)
async def list_users(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List users belonging to the current tenant. 
    Only tenant admins can list all users.
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Not authorized to list users")
        
    # Base query
    query = select(User).where(User.tenant_id == current_user.tenant_id)
    
    # Filtering
    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (User.full_name.ilike(search_filter)) | 
            (User.email.ilike(search_filter))
        )
    
    if is_active is not None:
        query = query.where(User.is_active == is_active)

    # Get total count before pagination
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination and sorting
    query = query.options(selectinload(User.entity_access)).order_by(User.full_name.asc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    items = result.scalars().all()
    
    return {"items": items, "total": total}


@router.get("/{user_id}", response_model=UserRead)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a single user by ID with entity access.
    """
    if not current_user.is_tenant_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this user")
        
    stmt = select(User).options(selectinload(User.entity_access)).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
    result = await db.execute(stmt)
    db_user = result.scalar_one_or_none()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    return db_user


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new user for the tenant.
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Not authorized to create users")
        
    # Check if email exists (case-insensitive)
    stmt = select(User).where(func.lower(User.email) == func.lower(user_in.email))
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    db_user = User(
        tenant_id=current_user.tenant_id,
        email=user_in.email,
        full_name=user_in.full_name,
        is_tenant_admin=user_in.is_tenant_admin,
        is_active=user_in.is_active,
        person_id=user_in.person_id,
    )
    
    # Hash password if provided (for demonstration, using a placeholder if no auth service)
    if user_in.password:
        from app.core.security.auth import get_password_hash
        db_user.password_hash = get_password_hash(user_in.password)
        
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    # Audit Log
    await AuditService.log_action(
        db=db,
        action="INSERT",
        table_name="users",
        record_id=db_user.id,
        new_value=user_in.model_dump(mode="json", exclude={"password"}),
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        ip_address=req.client.host if req.client else None
    )
    
    # Handle entity access
    if user_in.entity_access:
        for access in user_in.entity_access:
            db_access = UserEntityAccess(
                user_id=db_user.id,
                entity_id=access.entity_id,
                role_id=access.role_id,
                managed_department_ids=access.managed_department_ids,
                managed_group_ids=access.managed_group_ids,
                granted_by=current_user.id
            )
            db.add(db_access)
        await db.commit()
        # Refresh with entity_access loaded to avoid MissingGreenlet during serialization
        await db.refresh(db_user, ["entity_access"])
    else:
        # Load empty relationship explicitly
        await db.refresh(db_user, ["entity_access"])
        
    return db_user


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: uuid.UUID,
    user_in: UserUpdate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a user.
    """
    if not current_user.is_tenant_admin and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this user")
        
    stmt = select(User).options(selectinload(User.entity_access)).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
    res = await db.execute(stmt)
    db_user = res.scalar_one_or_none()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    from app.services.audit import to_dict
    old_val = to_dict(db_user)
        
    update_data = user_in.model_dump(exclude_unset=True)
    
    # Handle entity_access separately
    entity_access_in = update_data.pop("entity_access", None)
    
    # Prevent non-admins from making themselves an admin
    if not current_user.is_tenant_admin and "is_tenant_admin" in update_data:
        del update_data["is_tenant_admin"]
        
    if "password" in update_data:
        from app.core.security.auth import get_password_hash
        db_user.password_hash = get_password_hash(update_data.pop("password"))
        
    for field, value in update_data.items():
        setattr(db_user, field, value)
        
    if entity_access_in is not None:
        # Simplest way: replace all
        from sqlalchemy import delete
        await db.execute(delete(UserEntityAccess).where(UserEntityAccess.user_id == user_id))
        
        for access in entity_access_in:
            db_access = UserEntityAccess(
                user_id=user_id,
                entity_id=access["entity_id"],
                role_id=access["role_id"],
                managed_department_ids=access.get("managed_department_ids"),
                managed_group_ids=access.get("managed_group_ids"),
                granted_by=current_user.id
            )
            db.add(db_access)
            
    await db.commit()
    await db.refresh(db_user, ["entity_access"])

    # Audit Log
    await AuditService.log_action(
        db=db,
        action="UPDATE",
        table_name="users",
        record_id=user_id,
        old_value=old_val,
        new_value=user_in.model_dump(mode="json", exclude={"password"}, exclude_unset=True),
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        ip_address=req.client.host if req.client else None
    )

    return db_user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: uuid.UUID,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deactivate a user (soft delete).
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete users")
        
    stmt = select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
    res = await db.execute(stmt)
    db_user = res.scalar_one_or_none()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if db_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
    from app.services.audit import to_dict
    old_val = to_dict(db_user)
    
    db_user.is_active = False
    await db.commit()

    # Audit Log
    await AuditService.log_action(
        db=db,
        action="UPDATE",
        table_name="users",
        record_id=user_id,
        old_value=old_val,
        new_value={"is_active": False},
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        ip_address=req.client.host if req.client else None
    )
