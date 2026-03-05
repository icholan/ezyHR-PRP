from pydantic import BaseModel
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from app.core.security.permissions import Permission

class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None

class RoleCreate(RoleBase):
    permissions: List[Permission]

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permissions: Optional[List[Permission]] = None

class RoleRead(RoleBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    permissions: List[str] # List of string permission names
    
    class Config:
        from_attributes = True
