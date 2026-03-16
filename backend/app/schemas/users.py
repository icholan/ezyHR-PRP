from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime

class UserEntityAccessBase(BaseModel):
    entity_id: UUID
    role_id: UUID
    managed_department_ids: Optional[List[UUID]] = None
    managed_group_ids: Optional[List[UUID]] = None

class UserEntityAccessCreate(UserEntityAccessBase):
    pass

class UserEntityAccessRead(UserEntityAccessBase):
    id: UUID
    user_id: UUID
    granted_by: Optional[UUID] = None
    granted_at: datetime
    role_name: Optional[str] = None
    permissions: List[str] = []
    employment_id: Optional[UUID] = None
    
    class Config:
        from_attributes = True

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    is_tenant_admin: bool = False
    is_platform_admin: bool = False
    is_active: bool = True
    person_id: Optional[UUID] = None
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    password: Optional[str] = None
    entity_access: Optional[List[UserEntityAccessCreate]] = []

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_tenant_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None
    person_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    entity_access: Optional[List[UserEntityAccessCreate]] = None

class UserRead(UserBase):
    id: UUID
    tenant_id: UUID
    two_fa_enabled: bool
    setup_complete: Optional[bool] = False
    last_login: Optional[datetime] = None
    created_at: datetime
    entity_access: Optional[List[UserEntityAccessRead]] = []
    display_name: Optional[str] = None
    employment_id: Optional[UUID] = None
    selected_entity_id: Optional[UUID] = None
    
    class Config:
        from_attributes = True

class UserList(BaseModel):
    items: List[UserRead]
    total: int
