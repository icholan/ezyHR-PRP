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

class RoleUsage(BaseModel):
    entity_id: UUID
    entity_name: str
    user_count: int

class RoleRead(RoleBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime
    permissions: List[str]
    usage: List[RoleUsage] = [] # New: user counts per entity
    
    class Config:
        from_attributes = True
