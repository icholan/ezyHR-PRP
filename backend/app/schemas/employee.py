from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import date
import uuid

class PersonBase(BaseModel):
    full_name: str
    nationality: Optional[str] = None
    race: Optional[str] = None
    religion: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    contact_number: Optional[str] = None
    mobile_number: Optional[str] = None
    whatsapp_number: Optional[str] = None
    personal_email: Optional[EmailStr] = None
    language: Optional[str] = None
    highest_education: Optional[str] = None
    pr_start_date: Optional[date] = None
    work_pass_start: Optional[date] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    emergency_contact_number: Optional[str] = None

class PersonCreate(PersonBase):
    nric_fin: str  # Mandatory for creation, will be encrypted

class PersonUpdate(PersonBase):
    full_name: Optional[str] = None
    nric_fin: Optional[str] = None

class PersonRead(PersonBase):
    id: uuid.UUID
    nric_fin_last_4: Optional[str] = None # Masked version for UI

    class Config:
        from_attributes = True

class EmploymentBase(BaseModel):
    employee_code: Optional[str] = None
    employment_type: str = "full_time"
    job_title: Optional[str] = None
    department_id: Optional[uuid.UUID] = None
    grade_id: Optional[uuid.UUID] = None
    group_id: Optional[uuid.UUID] = None
    citizenship_type: str = "citizen"
    pr_year: Optional[int] = None
    work_pass_type: Optional[str] = None
    work_pass_no: Optional[str] = None
    work_pass_expiry: Optional[date] = None
    foreign_worker_levy: float = 0.0
    join_date: date
    resign_date: Optional[date] = None
    cessation_date: Optional[date] = None
    probation_end_date: Optional[date] = None
    designation: Optional[str] = None
    working_days_per_week: Optional[float] = None
    rest_day: Optional[str] = None
    work_hours_per_day: Optional[float] = None
    normal_work_hours_per_week: Optional[float] = None
    basic_salary: float = 0.0
    payment_mode: str = "bank_transfer"
    is_ot_eligible: bool = True
    is_active: bool = True

class EmploymentCreate(EmploymentBase):
    entity_id: uuid.UUID

class EmploymentUpdate(EmploymentBase):
    join_date: Optional[date] = None

class BankAccountBase(BaseModel):
    bank_name: str
    account_name: str
    is_default: bool = False

class BankAccountCreate(BankAccountBase):
    account_number: str

class BankAccountRead(BankAccountBase):
    id: uuid.UUID
    account_number_masked: str

class EmployeeFullCreate(BaseModel):
    person: PersonCreate
    employment: EmploymentCreate
    bank_account: Optional[BankAccountCreate] = None

class EmployeeSummary(BaseModel):
    id: uuid.UUID # Employment ID
    full_name: str
    employee_code: Optional[str]
    job_title: Optional[str]
    department_name: Optional[str]
    group_name: Optional[str] = None
    grade_name: Optional[str] = None
    is_active: bool
    join_date: date
    person_id: uuid.UUID

class EmployeeDetailPerson(BaseModel):
    id: uuid.UUID
    full_name: str
    nric_fin_last_4: Optional[str] = None
    nationality: Optional[str] = None
    race: Optional[str] = None
    religion: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    contact_number: Optional[str] = None
    mobile_number: Optional[str] = None
    whatsapp_number: Optional[str] = None
    personal_email: Optional[str] = None
    language: Optional[str] = None
    highest_education: Optional[str] = None
    pr_start_date: Optional[date] = None
    work_pass_start: Optional[date] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    emergency_contact_number: Optional[str] = None

class EmployeeDetailEmployment(BaseModel):
    id: uuid.UUID
    employee_code: Optional[str] = None
    employment_type: str
    job_title: Optional[str] = None
    department_id: Optional[uuid.UUID] = None
    department_name: Optional[str] = None
    grade_id: Optional[uuid.UUID] = None
    group_id: Optional[uuid.UUID] = None
    citizenship_type: str
    pr_year: Optional[int] = None
    work_pass_type: Optional[str] = None
    work_pass_no: Optional[str] = None
    work_pass_expiry: Optional[date] = None
    foreign_worker_levy: float
    join_date: date
    resign_date: Optional[date] = None
    cessation_date: Optional[date] = None
    probation_end_date: Optional[date] = None
    designation: Optional[str] = None
    working_days_per_week: Optional[float] = None
    rest_day: Optional[str] = None
    work_hours_per_day: Optional[float] = None
    normal_work_hours_per_week: Optional[float] = None
    basic_salary: float
    payment_mode: str
    is_ot_eligible: bool
    is_active: bool

class EmployeeDetailBank(BaseModel):
    id: uuid.UUID
    bank_name: str
    account_name: str
    account_number_masked: str
    is_default: bool

class EmployeeDetail(BaseModel):
    person: EmployeeDetailPerson
    employment: EmployeeDetailEmployment
    bank_account: Optional[EmployeeDetailBank] = None

class EmployeeFullUpdate(BaseModel):
    person: Optional[PersonUpdate] = None
    employment: Optional[EmploymentUpdate] = None
