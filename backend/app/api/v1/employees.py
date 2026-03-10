from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from app.api.v1.dependencies import get_db, get_current_active_user
from app.schemas.employee import EmployeeFullCreate, EmployeeSummary, EmployeeDetail, EmployeeFullUpdate, PersonRead
from app.services.employee import EmployeeService
from app.models import User
import uuid

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

@router.get("/persons", response_model=List[PersonRead])
async def list_persons(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only tenant admins can view all persons")
    service = EmployeeService(db)
    return await service.get_tenant_persons(current_user.tenant_id)

@router.get("/persons/{person_id}/employments", response_model=List[EmployeeSummary])
async def list_person_employments(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only tenant admins can view multi-entity employments")
    service = EmployeeService(db)
    return await service.get_person_employments(person_id)

@router.get("/persons/{person_id}", response_model=PersonRead)
async def get_person(
    person_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only tenant admins can view person details")
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
    service = EmployeeService(db)
    return await service.get_employees(entity_id, group_id=group_id)

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
    return detail

@router.post("", response_model=EmployeeSummary)
async def create_employee(
    data: EmployeeFullCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only admins can add employees")
        
    service = EmployeeService(db)
    emp = await service.create_employee(current_user.tenant_id, data)
    
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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only admins can edit employees")

    service = EmployeeService(db)
    detail = await service.update_employee(employment_id, data)
    if not detail:
        raise HTTPException(status_code=404, detail="Employee not found")
    return detail

@router.delete("/{employment_id}")
async def deactivate_employee(
    employment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only admins can deactivate employees")

    service = EmployeeService(db)
    success = await service.deactivate_employee(employment_id)
    if not success:
        raise HTTPException(status_code=404, detail="Employee not found")
    return {"message": "Employee deactivated successfully"}
