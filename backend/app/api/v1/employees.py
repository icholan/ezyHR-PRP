from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional

from app.api.v1.dependencies import get_db, get_current_active_user, require_permission, has_permission_internal, has_any_entity_permission
from app.core.security.permissions import Permission
from app.schemas.employee import EmployeeFullCreate, EmployeeSummary, EmployeeDetail, EmployeeFullUpdate, PersonRead
from pydantic import BaseModel
from app.services.employee import EmployeeService
from app.models import User, UserEntityAccess

import uuid

class InviteRequest(BaseModel):
    person_id: uuid.UUID

router = APIRouter(prefix="/employees", tags=["Employees"], redirect_slashes=False)

@router.get("/check-nric")
async def check_nric(
    nric: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = EmployeeService(db)
    person = await service.get_person_by_nric(current_user.tenant_id, nric)
    if person:
        return {
            "is_duplicate": True,
            "person": PersonRead.model_validate(person)
        }
    return {"is_duplicate": False, "person": None}

@router.post("/invite")
async def invite_employee(
    request: InviteRequest,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Invites an existing Person to the Employee Self-Service portal by generating a User account.
    """
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only Tenant Admins can invite users to the portal.")

    service = EmployeeService(db)
    temp_password = await service.invite_to_app(
        person_id=request.person_id,
        tenant_id=current_user.tenant_id,
        admin_user_id=current_user.id,
        ip_address=req.client.host if req.client else None
    )

    return {
        "message": "Employee successfully invited to the portal. Please provide them with this temporary password.",
        "temporary_password": temp_password
    }

@router.get("/persons", response_model=List[PersonRead])
async def list_persons(
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Enforce entity-scoped permission for listing persons
    await require_permission(Permission.MANAGE_MULTI_ENTITY)(entity_id, current_user, db)
    service = EmployeeService(db)
    return await service.get_tenant_persons(current_user.tenant_id)


@router.get("/persons/{person_id}/employments", response_model=List[EmployeeSummary])
async def list_person_employments(
    person_id: uuid.UUID,
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    await require_permission(Permission.MANAGE_MULTI_ENTITY)(entity_id, current_user, db)
    service = EmployeeService(db)
    return await service.get_person_employments(person_id)


@router.get("/persons/{person_id}", response_model=PersonRead)
async def get_person(
    person_id: uuid.UUID,
    entity_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if entity_id:
        await require_permission(Permission.MANAGE_MULTI_ENTITY)(entity_id, current_user, db)
    elif current_user.person_id != person_id:
        raise HTTPException(status_code=403, detail="Only tenant admins or authorized users can view person details")
        
    service = EmployeeService(db)
    person = await service.get_person_by_id(person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person

@router.get("/check-code")
async def check_code(
    code: str,
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = EmployeeService(db)
    is_duplicate = await service.is_employee_code_duplicate(entity_id, code)
    return {"is_duplicate": is_duplicate}

@router.get("", response_model=List[EmployeeSummary])
async def list_employees(
    entity_id: uuid.UUID,
    group_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Security: check permission for this entity
    await require_permission(Permission.VIEW_EMPLOYEES)(entity_id, current_user, db)
    
    # Data Isolation: restrict to managed groups/depts
    managed_groups = None
    managed_depts = None
    
    if not current_user.is_tenant_admin:
        stmt = select(UserEntityAccess).where(
            UserEntityAccess.user_id == current_user.id,
            UserEntityAccess.entity_id == entity_id
        )
        res = await db.execute(stmt)
        access = res.scalar_one_or_none()
        if access:
            managed_groups = access.managed_group_ids
            managed_depts = access.managed_department_ids

    service = EmployeeService(db)
    return await service.get_employees(
        entity_id, 
        group_id=group_id,
        managed_group_ids=managed_groups,
        managed_dept_ids=managed_depts
    )


@router.get("/me", response_model=EmployeeDetail)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not current_user.person_id:
        raise HTTPException(status_code=404, detail="No employee record associated with this user")
    
    service = EmployeeService(db)
    emp_id = await service.get_primary_employment_id(current_user.person_id)
    if not emp_id:
        raise HTTPException(status_code=404, detail="No active employment found")
        
    detail = await service.get_employee_detail(emp_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Employee details not found")
        
    return detail

@router.put("/me", response_model=EmployeeDetail)
async def update_my_profile(
    data: EmployeeFullUpdate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not current_user.person_id:
        raise HTTPException(status_code=404, detail="No employee record associated with this user")
        
    # Security: Ensure they don't try to update employment details or salary
    data.employment = None
    data.salary_components = None
    data.bank_account = None
    
    service = EmployeeService(db)
    emp_id = await service.get_primary_employment_id(current_user.person_id)
    if not emp_id:
        raise HTTPException(status_code=404, detail="No active employment found")
        
    detail = await service.update_employee(
        employment_id=emp_id,
        data=data,
        user_id=current_user.id,
        ip_address=req.client.host if req.client else None
    )
    return detail

@router.get("/{employment_id}", response_model=EmployeeDetail)
async def get_employee(
    employment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = EmployeeService(db)
    detail = await service.get_employee_detail(employment_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    # Security: check if user is global admin OR has VIEW_EMPLOYEES permission for this entity
    allowed = await has_permission_internal(
        db, current_user, detail.employment.entity_id, Permission.VIEW_EMPLOYEES
    )
    
    if not allowed and detail.person.id != current_user.person_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this employee")
            
    # Data Isolation for non-admins
    if not current_user.is_tenant_admin and detail.person.id != current_user.person_id:
        stmt = select(UserEntityAccess).where(
            UserEntityAccess.user_id == current_user.id,
            UserEntityAccess.entity_id == detail.employment.entity_id
        )
        res = await db.execute(stmt)
        access = res.scalar_one_or_none()
        if access:
            if access.managed_group_ids is not None and detail.employment.group_id not in access.managed_group_ids:
                raise HTTPException(status_code=403, detail="Employee outside your assigned groups")
            if access.managed_department_ids is not None and detail.employment.department_id not in access.managed_department_ids:
                raise HTTPException(status_code=403, detail="Employee outside your assigned departments")

    return detail


@router.post("", response_model=EmployeeSummary)
async def create_employee(
    data: EmployeeFullCreate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Security: check permission for the target entity
    allowed = await has_permission_internal(
        db, current_user, data.employment.entity_id, Permission.EDIT_EMPLOYEES
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Only admins with edit permission can add employees")
        
    service = EmployeeService(db)
    emp = await service.create_employee(
        tenant_id=current_user.tenant_id, 
        data=data, 
        user_id=current_user.id,
        ip_address=req.client.host if req.client else None
    )
    
    return EmployeeSummary(
        id=emp.id,
        full_name=data.person.full_name,
        employee_code=emp.employee_code,
        job_title=emp.job_title,
        department_name=None,
        is_active=emp.is_active,
        join_date=emp.join_date,
        person_id=emp.person_id
    )

@router.put("/{employment_id}", response_model=EmployeeDetail)
async def update_employee(
    employment_id: uuid.UUID,
    data: EmployeeFullUpdate,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = EmployeeService(db)
    detail = await service.get_employee_detail(employment_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Security: check permission for the target entity
    allowed = await has_permission_internal(
        db, current_user, detail.employment.entity_id, Permission.EDIT_EMPLOYEES
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Only admins with edit permission can edit employees")

    # Data Isolation for non-admins
    if not current_user.is_tenant_admin:
        stmt = select(UserEntityAccess).where(
            UserEntityAccess.user_id == current_user.id,
            UserEntityAccess.entity_id == detail.employment.entity_id
        )
        res = await db.execute(stmt)
        access = res.scalar_one_or_none()
        if access:
            if access.managed_group_ids is not None and detail.employment.group_id not in access.managed_group_ids:
                raise HTTPException(status_code=403, detail="Employee outside your assigned groups")
            if access.managed_department_ids is not None and detail.employment.department_id not in access.managed_department_ids:
                raise HTTPException(status_code=403, detail="Employee outside your assigned departments")


    detail = await service.update_employee(
        employment_id=employment_id, 
        data=data,
        user_id=current_user.id,
        ip_address=req.client.host if req.client else None
    )
    if not detail:
        raise HTTPException(status_code=404, detail="Employee not found")
    return detail

@router.delete("/{employment_id}")
async def deactivate_employee(
    employment_id: uuid.UUID,
    req: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    service = EmployeeService(db)
    detail = await service.get_employee_detail(employment_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Security: check permission for the target entity
    allowed = await has_permission_internal(
        db, current_user, detail.employment.entity_id, Permission.DELETE_EMPLOYEES
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Only admins with delete permission can deactivate employees")

    # Data Isolation for non-admins
    if not current_user.is_tenant_admin:
        stmt = select(UserEntityAccess).where(
            UserEntityAccess.user_id == current_user.id,
            UserEntityAccess.entity_id == detail.employment.entity_id
        )
        res = await db.execute(stmt)
        access = res.scalar_one_or_none()
        if access:
            if access.managed_group_ids is not None and detail.employment.group_id not in access.managed_group_ids:
                raise HTTPException(status_code=403, detail="Employee outside your assigned groups")
            if access.managed_department_ids is not None and detail.employment.department_id not in access.managed_department_ids:
                raise HTTPException(status_code=403, detail="Employee outside your assigned departments")


    success = await service.deactivate_employee(
        employment_id=employment_id,
        user_id=current_user.id,
        ip_address=req.client.host if req.client else None
    )
    if not success:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deactivated successfully"}
