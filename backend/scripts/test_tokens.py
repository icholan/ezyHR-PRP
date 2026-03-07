import asyncio
import os
import sys
from datetime import timedelta
from jose import jwt
import uuid

# Add the backend directory to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.security.auth import SECRET_KEY, ALGORITHM, create_platform_admin_token, create_tenant_user_token
from app.api.v1.dependencies import get_current_user
from app.api.platform.dependencies import get_current_platform_admin, get_current_super_admin

async def test_tokens():
    admin_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    tenant_id = str(uuid.uuid4())

    print(f"DEBUG: SECRET_KEY={SECRET_KEY}")
    print(f"DEBUG: ALGORITHM={ALGORITHM}")

    # 1. Create Platform Admin Token
    platform_token = create_platform_admin_token(admin_id, "super_admin")
    print("\n--- Platform Admin Token ---")
    print(platform_token)
    
    # Verify platform token handles correctly in platform dependencies
    try:
        payload = jwt.decode(platform_token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"Decoded Payload: {payload}")
    except Exception as e:
        print(f"Decode Failed: {e}")

    # 2. Test Platform Token against V1 Dependency (Expected to FAIL)
    print("\n--- Testing Platform Token against V1 get_current_user ---")
    # Simulate get_current_user logic
    try:
        payload = jwt.decode(platform_token, SECRET_KEY, algorithms=[ALGORITHM])
        u_id = payload.get("sub")
        t_type = payload.get("type")
        t_id = payload.get("tenant_id")
        print(f"Payload check: sub={u_id}, type={t_type}, tenant_id={t_id}")
        if u_id is None or t_id is None:
            print("FAILED: sub or tenant_id is None (This is the bug for platform admins)")
        if t_type not in ["tenant_user", "impersonation"]:
            print(f"FAILED: invalid type {t_type}")
    except Exception as e:
        print(f"Error: {e}")

    # 3. Create Tenant User Token
    tenant_token = create_tenant_user_token(user_id, tenant_id, is_admin=True)
    print("\n--- Tenant User Token ---")
    print(tenant_token)
    try:
        payload = jwt.decode(tenant_token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"Decoded Payload: {payload}")
    except Exception as e:
        print(f"Decode Failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_tokens())
