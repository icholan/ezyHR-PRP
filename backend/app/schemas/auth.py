from pydantic import BaseModel, EmailStr
from typing import Optional, List, Union
from uuid import UUID
from datetime import datetime
from app.schemas.users import UserRead

class PlatformAdminBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str
    is_active: bool = True
    is_platform_admin: bool = True
    is_tenant_admin: bool = False
    is_mfa_enabled: bool = True

class PlatformAdminResponse(PlatformAdminBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    mfa_required: bool = False
    user: Optional[Union[UserRead, PlatformAdminResponse]] = None

class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None
    type: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ImpersonationRequest(BaseModel):
    user_id: UUID
    reason: str

class MFARequest(BaseModel):
    admin_id: UUID
    code: str


class MFASetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
