from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime
import uuid

class EntityBase(BaseModel):
    name: str
    uen: Optional[str] = None
    cpf_account_no: Optional[str] = None
    iras_tax_ref: Optional[str] = None
    registered_address: Optional[str] = None
    gst_registered: bool = False
    gst_no: Optional[str] = None
    industry_code: Optional[str] = None
    payroll_cutoff_day: int = 25
    payment_day: int = 28
    work_week_hours: float = 44.0
    attendance_roster_mode: str = "manual"
    website: Optional[str] = None
    bank_name: Optional[str] = None
    bank_account_no: Optional[str] = None
    bank_account_name: Optional[str] = None
    bank_branch_code: Optional[str] = None
    bank_swift_code: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool = True

class EntityCreate(EntityBase):
    uen: str
    bank_name: str
    bank_account_no: str
    bank_account_name: str
    bank_branch_code: str

class EntityUpdate(BaseModel):
    name: Optional[str] = None
    uen: Optional[str] = None
    cpf_account_no: Optional[str] = None
    iras_tax_ref: Optional[str] = None
    registered_address: Optional[str] = None
    gst_registered: Optional[bool] = None
    gst_no: Optional[str] = None
    industry_code: Optional[str] = None
    payroll_cutoff_day: Optional[int] = None
    payment_day: Optional[int] = None
    work_week_hours: Optional[float] = None
    attendance_roster_mode: Optional[str] = None
    is_active: Optional[bool] = None

class EntityRead(EntityBase):
    id: uuid.UUID
    tenant_id: uuid.UUID
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
