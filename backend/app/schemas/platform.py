from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

class TenantRead(BaseModel):
    id: uuid.UUID
    name: str
    subscription_plan: str
    billing_email: str
    setup_complete: bool
    is_active: bool
    suspended_at: Optional[datetime] = None
    trial_ends_at: Optional[datetime] = None
    mrr: Optional[float] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class TenantStats(BaseModel):
    total_tenants: int
    active_tenants: int
    total_mrr: float
    new_this_month: int

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    billing_email: Optional[str] = None
    is_active: Optional[bool] = None

class SubscriptionUpdate(BaseModel):
    subscription_plan: Optional[str] = None
    mrr: Optional[float] = None

from datetime import date

# Statutory Config Schemas (CPF, SHG, SDL)
class CPFRateCreate(BaseModel):
    citizenship_type: str
    age_from: int
    age_to: int
    employee_rate: float
    employer_rate: float
    ow_ceiling: float = 6800.0
    aw_ceiling_annual: float = 102000.0
    effective_date: date
    end_date: Optional[date] = None

class CPFRateRead(CPFRateCreate):
    id: uuid.UUID
    is_expired: bool
    class Config:
        from_attributes = True

class SHGRateCreate(BaseModel):
    shg_type: str
    wage_from: float
    wage_to: Optional[float] = None
    deduction_amount: float
    effective_date: date
    end_date: Optional[date] = None

class SHGRateRead(SHGRateCreate):
    id: uuid.UUID
    is_expired: bool
    class Config:
        from_attributes = True

class SDLRateCreate(BaseModel):
    rate: float = 0.00250
    min_amount: float = 2.00
    max_amount: float = 11.25
    effective_date: date
    end_date: Optional[date] = None

class SDLRateRead(SDLRateCreate):
    id: uuid.UUID
    is_expired: bool
    class Config:
        from_attributes = True

# CPF Allocation Config Schemas
class CPFAllocationCreate(BaseModel):
    age_from: int
    age_to: int
    oa_ratio: float
    sa_ratio: float
    ma_ratio: float
    effective_date: date
    end_date: Optional[date] = None

class CPFAllocationRead(CPFAllocationCreate):
    id: uuid.UUID
    is_expired: bool
    class Config:
        from_attributes = True
