from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List

class AuditLogBase(BaseModel):
    tenant_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    entity_id: Optional[UUID] = None
    table_name: str
    record_id: Optional[UUID] = None
    action: str
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    impersonated_by: Optional[UUID] = None

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogRead(AuditLogBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class SystemAuditLogBase(BaseModel):
    admin_id: Optional[UUID] = None
    user_id: Optional[UUID] = None
    tenant_id: Optional[UUID] = None
    action: str
    ip_address: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class SystemAuditLogCreate(SystemAuditLogBase):
    pass

class SystemAuditLogRead(SystemAuditLogBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class PaginatedAuditLogs(BaseModel):
    items: List[AuditLogRead]
    total: int

class PaginatedSystemAuditLogs(BaseModel):
    items: List[SystemAuditLogRead]
    total: int
