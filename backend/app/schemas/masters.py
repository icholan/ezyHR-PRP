from pydantic import BaseModel, UUID4, ConfigDict
from datetime import datetime
from typing import Optional

class MasterBase(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)

# --- Department ---
class DepartmentCreate(MasterBase):
    entity_id: UUID4
    parent_id: Optional[UUID4] = None

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[UUID4] = None
    is_active: Optional[bool] = None

class DepartmentRead(MasterBase):
    id: UUID4
    entity_id: UUID4
    parent_id: Optional[UUID4] = None
    created_at: datetime
    updated_at: datetime

# --- Grade ---
class GradeCreate(MasterBase):
    entity_id: UUID4

class GradeUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class GradeRead(MasterBase):
    id: UUID4
    entity_id: UUID4
    created_at: datetime
    updated_at: datetime

# --- Group ---
class GroupCreate(MasterBase):
    entity_id: UUID4

class GroupUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class GroupRead(MasterBase):
    id: UUID4
    entity_id: UUID4
    created_at: datetime
    updated_at: datetime

# --- Customer ---
class CustomerBase(BaseModel):
    name: str
    code: Optional[str] = None
    uen: Optional[str] = None
    billing_address: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_number: Optional[str] = None
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)

class CustomerCreate(CustomerBase):
    entity_id: UUID4

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    uen: Optional[str] = None
    billing_address: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_number: Optional[str] = None
    is_active: Optional[bool] = None

class CustomerRead(CustomerBase):
    id: UUID4
    entity_id: UUID4
    created_at: datetime
    updated_at: datetime
