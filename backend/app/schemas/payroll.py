from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

class PayrollRecordBase(BaseModel):
    employment_id: UUID
    period: date
    basic_salary: Decimal
    allowances: Decimal = Decimal("0")
    bonus: Decimal = Decimal("0")
    overtime_pay: Decimal = Decimal("0")
    unpaid_leave_deduction: Decimal = Decimal("0")
    cpf_employee: Decimal = Decimal("0")
    cpf_employer: Decimal = Decimal("0")
    shg_deduction: Decimal = Decimal("0")
    sdl_contribution: Decimal = Decimal("0")
    gross_salary: Decimal = Decimal("0")
    net_salary: Decimal = Decimal("0")

class PayrollRecordCreate(PayrollRecordBase):
    payroll_run_id: UUID
    entity_id: UUID

class PayrollRecordResponse(PayrollRecordBase):
    id: UUID
    status: str
    model_config = ConfigDict(from_attributes=True)

class PayrollRunBase(BaseModel):
    entity_id: UUID
    period: date

class PayrollRunCreate(PayrollRunBase):
    notes: Optional[str] = None

class PayrollRunResponse(PayrollRunBase):
    id: UUID
    status: str
    total_gross: Decimal
    total_net: Decimal
    total_cpf_ee: Decimal = Decimal("0")
    total_cpf_er: Decimal = Decimal("0")
    total_shg: Decimal = Decimal("0")
    total_sdl: Decimal = Decimal("0")
    total_fwl: Decimal = Decimal("0")
    total_employees: int = 0
    ai_audit_run: bool
    ai_flags_count: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PayrollRunDetail(PayrollRunResponse):
    records: List[PayrollRecordResponse]
