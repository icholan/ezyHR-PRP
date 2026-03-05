from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import uuid

from app.core.database import get_db
from app.models.auth import User
from app.core.security.permissions import Permission
from app.models.employment import Department, Grade, Group, Customer
from app.schemas.masters import (
    DepartmentCreate, DepartmentUpdate, DepartmentRead,
    GradeCreate, GradeUpdate, GradeRead,
    GroupCreate, GroupUpdate, GroupRead,
    CustomerCreate, CustomerUpdate, CustomerRead
)
from app.api.v1.dependencies import get_current_active_user, get_entity_access, require_permission

router = APIRouter()

# --- Shared Helpers ---
async def get_master_item(db: AsyncSession, model, item_id: uuid.UUID, entity_id: uuid.UUID):
    result = await db.execute(select(model).where(model.id == item_id, model.entity_id == entity_id))
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail=f"{model.__name__} not found")
    return item

# --- Departments ---
@router.get("/departments", response_model=List[DepartmentRead])
async def list_departments(
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    await get_entity_access(entity_id, current_user, db)
    result = await db.execute(select(Department).where(Department.entity_id == entity_id))
    return result.scalars().all()

@router.post("/departments", response_model=DepartmentRead)
async def create_department(
    dept_in: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    _has_permission = Depends(require_permission(Permission.MANAGE_ROLES))
):
    db_dept = Department(**dept_in.model_dump())
    db.add(db_dept)
    await db.commit()
    await db.refresh(db_dept)
    return db_dept

@router.patch("/departments/{dept_id}", response_model=DepartmentRead)
async def update_department(
    dept_id: uuid.UUID,
    entity_id: uuid.UUID,
    dept_in: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
    _has_permission = Depends(require_permission(Permission.MANAGE_ROLES))
):
    db_dept = await get_master_item(db, Department, dept_id, entity_id)
    
    update_data = dept_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_dept, field, value)
        
    await db.commit()
    await db.refresh(db_dept)
    return db_dept

@router.delete("/departments/{dept_id}", response_model=dict)
async def delete_department(
    dept_id: uuid.UUID,
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _has_permission = Depends(require_permission(Permission.MANAGE_ROLES))
):
    db_dept = await get_master_item(db, Department, dept_id, entity_id)
    db_dept.is_active = False
    await db.commit()
    return {"status": "success", "message": "Department deactivated"}


# --- Grades ---
@router.get("/grades", response_model=List[GradeRead])
async def list_grades(
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    await get_entity_access(entity_id, current_user, db)
    result = await db.execute(select(Grade).where(Grade.entity_id == entity_id))
    return result.scalars().all()

@router.post("/grades", response_model=GradeRead)
async def create_grade(
    grade_in: GradeCreate,
    db: AsyncSession = Depends(get_db),
    _has_permission = Depends(require_permission(Permission.MANAGE_ROLES))
):
    db_grade = Grade(**grade_in.model_dump())
    db.add(db_grade)
    await db.commit()
    await db.refresh(db_grade)
    return db_grade

@router.patch("/grades/{grade_id}", response_model=GradeRead)
async def update_grade(
    grade_id: uuid.UUID,
    entity_id: uuid.UUID,
    grade_in: GradeUpdate,
    db: AsyncSession = Depends(get_db),
    _has_permission = Depends(require_permission(Permission.MANAGE_ROLES))
):
    db_grade = await get_master_item(db, Grade, grade_id, entity_id)
    
    update_data = grade_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_grade, field, value)
        
    await db.commit()
    await db.refresh(db_grade)
    return db_grade

@router.delete("/grades/{grade_id}", response_model=dict)
async def delete_grade(
    grade_id: uuid.UUID,
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _has_permission = Depends(require_permission(Permission.MANAGE_ROLES))
):
    db_grade = await get_master_item(db, Grade, grade_id, entity_id)
    db_grade.is_active = False
    await db.commit()
    return {"status": "success", "message": "Grade deactivated"}


# --- Groups ---
@router.get("/groups", response_model=List[GroupRead])
async def list_groups(
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    await get_entity_access(entity_id, current_user, db)
    result = await db.execute(select(Group).where(Group.entity_id == entity_id))
    return result.scalars().all()

@router.post("/groups", response_model=GroupRead)
async def create_group(
    group_in: GroupCreate,
    db: AsyncSession = Depends(get_db),
    _has_permission = Depends(require_permission(Permission.MANAGE_ROLES))
):
    db_group = Group(**group_in.model_dump())
    db.add(db_group)
    await db.commit()
    await db.refresh(db_group)
    return db_group

@router.patch("/groups/{group_id}", response_model=GroupRead)
async def update_group(
    group_id: uuid.UUID,
    entity_id: uuid.UUID,
    group_in: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    _has_permission = Depends(require_permission(Permission.MANAGE_ROLES))
):
    db_group = await get_master_item(db, Group, group_id, entity_id)
    
    update_data = group_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_group, field, value)
        
    await db.commit()
    await db.refresh(db_group)
    return db_group

@router.delete("/groups/{group_id}", response_model=dict)
async def delete_group(
    group_id: uuid.UUID,
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _has_permission = Depends(require_permission(Permission.MANAGE_ROLES))
):
    db_group = await get_master_item(db, Group, group_id, entity_id)
    db_group.is_active = False
    await db.commit()
    return {"status": "success", "message": "Group deactivated"}


# --- Customers ---
@router.get("/customers", response_model=List[CustomerRead])
async def list_customers(
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    await get_entity_access(entity_id, current_user, db)
    result = await db.execute(select(Customer).where(Customer.entity_id == entity_id))
    return result.scalars().all()

@router.post("/customers", response_model=CustomerRead)
async def create_customer(
    customer_in: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    _has_permission = Depends(require_permission(Permission.MANAGE_ROLES))
):
    db_customer = Customer(**customer_in.model_dump())
    db.add(db_customer)
    await db.commit()
    await db.refresh(db_customer)
    return db_customer

@router.patch("/customers/{customer_id}", response_model=CustomerRead)
async def update_customer(
    customer_id: uuid.UUID,
    entity_id: uuid.UUID,
    customer_in: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    _has_permission = Depends(require_permission(Permission.MANAGE_ROLES))
):
    db_customer = await get_master_item(db, Customer, customer_id, entity_id)
    
    update_data = customer_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_customer, field, value)
        
    await db.commit()
    await db.refresh(db_customer)
    return db_customer

@router.delete("/customers/{customer_id}", response_model=dict)
async def delete_customer(
    customer_id: uuid.UUID,
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _has_permission = Depends(require_permission(Permission.MANAGE_ROLES))
):
    db_customer = await get_master_item(db, Customer, customer_id, entity_id)
    db_customer.is_active = False
    await db.commit()
    return {"status": "success", "message": "Customer deactivated"}
