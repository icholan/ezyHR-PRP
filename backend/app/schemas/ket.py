from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime, date
import uuid

class KETBase(BaseModel):
    status: str = "draft"
    version: int = 1

class KETCreate(BaseModel):
    employment_id: uuid.UUID

class KETUpdate(BaseModel):
    status: Optional[str] = None
    signed_at: Optional[datetime] = None
    signed_by_employee_id: Optional[uuid.UUID] = None

class KETRead(KETBase):
    id: uuid.UUID
    employment_id: uuid.UUID
    terms_json: Dict[str, Any]
    issued_at: Optional[datetime] = None
    signed_at: Optional[datetime] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class KETSummary(BaseModel):
    id: uuid.UUID
    employment_id: uuid.UUID
    employee_name: str
    employee_code: Optional[str]
    job_title: Optional[str]
    status: str
    version: int
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class KETDashboardResponse(BaseModel):
    stats: Dict[str, int]
    items: List[KETSummary]
