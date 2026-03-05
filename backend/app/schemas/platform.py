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
