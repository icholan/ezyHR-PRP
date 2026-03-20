import uuid
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

# Claim Category
class ClaimCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True

class ClaimCategoryCreate(ClaimCategoryBase):
    entity_id: uuid.UUID

class ClaimCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ClaimCategoryRead(ClaimCategoryBase):
    id: uuid.UUID
    entity_id: uuid.UUID
    tenant_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

# Claim Request
class ClaimRequestBase(BaseModel):
    title: str
    description: Optional[str] = None
    amount: float
    claim_date: date

class ClaimRequestCreate(ClaimRequestBase):
    category_id: uuid.UUID

class ClaimRequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    claim_date: Optional[date] = None
    status: Optional[str] = None
    rejection_reason: Optional[str] = None

class ClaimStatusUpdate(BaseModel):
    status: Optional[str] = None
    rejection_reason: Optional[str] = None

# Claim Receipt
class ClaimReceiptBase(BaseModel):
    receipt_url: str
    filename: str

class ClaimReceiptRead(ClaimReceiptBase):
    id: uuid.UUID
    claim_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)

class ClaimRequestRead(ClaimRequestBase):
    id: uuid.UUID
    employment_id: uuid.UUID
    category_id: uuid.UUID
    status: str
    rejection_reason: Optional[str] = None
    approved_by: Optional[uuid.UUID] = None
    approved_at: Optional[datetime] = None
    payroll_run_id: Optional[uuid.UUID] = None
    category: Optional[ClaimCategoryRead] = None
    receipts: List[ClaimReceiptRead] = []
    
    model_config = ConfigDict(from_attributes=True)
