from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict
from datetime import date, datetime
import uuid


# ─────────────────────────────────────────────
# Leave Types
# ─────────────────────────────────────────────

class LeaveTypeBase(BaseModel):
    name: str
    code: str
    is_paid: bool = True
    is_statutory: bool = True
    description: Optional[str] = None

class LeaveTypeCreate(LeaveTypeBase):
    pass

class LeaveTypeUpdate(BaseModel):
    name: Optional[str] = None
    is_paid: Optional[bool] = None
    is_statutory: Optional[bool] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None
    pool_id: Optional[uuid.UUID] = None
    pool_sub_cap: Optional[float] = None

class LeaveTypeRead(LeaveTypeBase):
    id: uuid.UUID
    entity_id: uuid.UUID
    is_active: bool = True
    pool_id: Optional[uuid.UUID] = None
    pool_sub_cap: Optional[float] = None

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Leave Entitlement
# ─────────────────────────────────────────────

class LeaveEntitlementCreate(BaseModel):
    employment_id: uuid.UUID
    leave_type_id: uuid.UUID
    year: int
    total_days: float
    carried_over_days: float = 0.0

class LeaveEntitlementUpdate(BaseModel):
    total_days: Optional[float] = None
    carried_over_days: Optional[float] = None

class LeaveEntitlementRead(BaseModel):
    id: uuid.UUID
    employment_id: uuid.UUID
    leave_type_id: uuid.UUID
    leave_type: Optional[LeaveTypeRead] = None
    year: int
    total_days: float
    used_days: float
    pending_days: float
    carried_over_days: float

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Leave Requests
# ─────────────────────────────────────────────

class LeaveRequestCreate(BaseModel):
    leave_type_id: uuid.UUID
    employment_id: uuid.UUID
    start_date: date
    end_date: date
    reason: Optional[str] = None
    attachment_url: Optional[str] = None
    child_birth_date: Optional[date] = None  # Required for GPPL/SPL
    child_order: Optional[int] = None      # Required for Maternity

class LeaveRequestRead(BaseModel):
    id: uuid.UUID
    employment_id: uuid.UUID
    leave_type_id: uuid.UUID
    leave_type: Optional[LeaveTypeRead] = None
    start_date: date
    end_date: date
    days_count: float
    reason: Optional[str] = None
    status: str
    attachment_url: Optional[str] = None
    child_birth_date: Optional[date] = None
    child_order: Optional[int] = None
    approved_by: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    class Config:
        from_attributes = True

class LeaveRequestUpdate(BaseModel):
    status: str
    rejection_reason: Optional[str] = None

class LeaveRequestManagementRead(BaseModel):
    id: uuid.UUID
    employment_id: uuid.UUID
    employee_name: str
    employee_code: str
    leave_type_name: str
    start_date: date
    end_date: date
    days_count: float
    status: str
    reason: Optional[str] = None
    attachment_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Leave Balance
# ─────────────────────────────────────────────

class LeaveBalanceRead(BaseModel):
    leave_type_id: str
    leave_type_name: str
    leave_type_code: str
    total_days: float
    used_days: float
    pending_days: float
    carried_over_days: float = 0.0
    available_days: float
    is_statutory: bool
    is_paid: bool = True
    tenure_months: int
    pool_code: Optional[str] = None


# ─────────────────────────────────────────────
# Phase 1: Leave Pools
# ─────────────────────────────────────────────

class LeavePoolCreate(BaseModel):
    code: str
    name: str
    cap_days: float
    scope: str = "employment"   # 'employment' | 'family'
    effective_from: date
    effective_to: Optional[date] = None
    notes: Optional[str] = None

class LeavePoolUpdate(BaseModel):
    cap_days: Optional[float] = None
    effective_to: Optional[date] = None
    notes: Optional[str] = None

class LeavePoolRead(BaseModel):
    id: uuid.UUID
    entity_id: uuid.UUID
    code: str
    name: str
    cap_days: float
    scope: str
    effective_from: date
    effective_to: Optional[date] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Phase 1: Statutory Leave Rules
# ─────────────────────────────────────────────

class StatutoryLeaveRuleCreate(BaseModel):
    leave_type_code: str
    effective_from: date
    effective_to: Optional[date] = None
    tenure_unit: str                  # 'months' | 'years'
    progression: List[Dict[str, Any]] # [{"min_tenure": 0, "days": 7}, ...]
    notes: Optional[str] = None

class StatutoryLeaveRuleRead(BaseModel):
    id: uuid.UUID
    leave_type_code: str
    effective_from: date
    effective_to: Optional[date] = None
    tenure_unit: str
    progression: List[Dict[str, Any]]
    notes: Optional[str] = None

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Phase 1: Leave Type Policies (Company Overrides)
# ─────────────────────────────────────────────

class LeaveTypePolicyCreate(BaseModel):
    leave_type_code: str
    override_days: Optional[float] = None
    effective_from: date
    effective_to: Optional[date] = None
    notes: Optional[str] = None

class LeaveTypePolicyRead(BaseModel):
    id: uuid.UUID
    entity_id: uuid.UUID
    leave_type_code: str
    override_days: Optional[float] = None
    effective_from: date
    effective_to: Optional[date] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Phase 2B: Leave Carry Policies
# ─────────────────────────────────────────────

class LeaveCarryPolicyCreate(BaseModel):
    leave_type_code: str
    max_carry_days: float
    carry_expiry_months: Optional[int] = None
    effective_from: date
    effective_to: Optional[date] = None
    notes: Optional[str] = None

class LeaveCarryPolicyRead(BaseModel):
    id: uuid.UUID
    entity_id: uuid.UUID
    leave_type_code: str
    max_carry_days: float
    carry_expiry_months: Optional[int] = None
    effective_from: date
    effective_to: Optional[date] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Selective Leave Seeding
# ─────────────────────────────────────────────

class AvailableLeaveTypeRead(BaseModel):
    code: str
    name: str
    is_statutory: bool
    category: str

class StandardLeaveSeedRequest(BaseModel):
    codes: Optional[List[str]] = None
