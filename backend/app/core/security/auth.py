from datetime import datetime, timedelta
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext
import pyotp
import os

# Password hashing
pwd_context = CryptContext(schemes=["pbkdf2_sha256"])

# JWT configuration
SECRET_KEY = os.getenv("SECRET_KEY", "764df388-b3a0-446f-acf9-204979b58454")
ALGORITHM = "HS256"
PLATFORM_TOKEN_EXPIRE_HOURS = int(os.getenv("PLATFORM_TOKEN_EXPIRE_HOURS", "8"))
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Union[timedelta, None] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_platform_admin_token(admin_id: str, role: str) -> str:
    """Creates a JWT for Platform Admins with a specific type."""
    expires = timedelta(hours=PLATFORM_TOKEN_EXPIRE_HOURS)
    return create_access_token(
        data={
            "sub": str(admin_id),
            "role": role,
            "type": "platform_admin"
        },
        expires_delta=expires
    )

def create_tenant_user_token(user_id: str, tenant_id: str, is_admin: bool) -> str:
    """Creates a JWT for Tenant Users (HR, Managers, Employees)."""
    return create_access_token(
        data={
            "sub": str(user_id),
            "tenant_id": str(tenant_id),
            "is_admin": is_admin,
            "type": "tenant_user"
        }
    )

def create_impersonation_token(user_id: str, tenant_id: str, admin_id: str) -> str:
    """Creates a temporary JWT for Support Admins to troubleshoot as a user."""
    # Impersonation tokens are short-lived (15 mins)
    expires = timedelta(minutes=15)
    return create_access_token(
        data={
            "sub": str(user_id),
            "tenant_id": str(tenant_id),
            "impersonated_by": str(admin_id),
            "type": "impersonation"
        },
        expires_delta=expires
    )

# MFA Logic
def generate_mfa_secret() -> str:
    return pyotp.random_base32()

def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code)

def get_provisioning_uri(secret: str, email: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=email, 
        issuer_name="Singapore HRMS"
    )
