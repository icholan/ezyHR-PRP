import asyncio
import os
import sys

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.tenant import PlatformAdmin, Tenant, Entity
from app.models.auth import User, UserEntityAccess, Role, RolePermission
from app.core.security.permissions import Permission
from app.core.security.auth import get_password_hash
from sqlalchemy import select

async def seed_admins_only():
    print("🚀 Seeding Admin Users safely (without dropping tables)...")
    
    async with AsyncSessionLocal() as session:
        # 1. Seed Platform Super Admin
        admin_email = "admin@ezy.sg"
        admin_password = "Manager@123"
        
        result = await session.execute(select(PlatformAdmin).where(PlatformAdmin.email == admin_email))
        admin = result.scalar_one_or_none()
        
        if not admin:
            mfa_secret = "JBSWY3DPEHPK3PXP" # Static for dev testing
            admin = PlatformAdmin(
                email=admin_email,
                password_hash=get_password_hash(admin_password),
                full_name="System Super Admin",
                role="super_admin",
                mfa_secret=mfa_secret,
                mfa_enabled=True,
                is_active=True
            )
            session.add(admin)
            print(f"✅ Platform Admin created: {admin_email}")
        else:
            admin.password_hash = get_password_hash(admin_password)
            print(f"🔄 Platform Admin password updated: {admin_email}")

        # 2. Setup Tenant and Role (Required for Tenant Admin)
        # Check if Acme Singapore Corp exists (created by seed_dev_data), if not create it
        result = await session.execute(select(Tenant).where(Tenant.name == "Acme Singapore Corp"))
        tenant = result.scalar_one_or_none()
        if not tenant:
            tenant = Tenant(
                name="Acme Singapore Corp",
                subscription_plan="starter",
                billing_email="billing@acme.com",
                setup_complete=True,
                is_active=True
            )
            session.add(tenant)
            await session.flush()
            print(f"✅ Tenant created: {tenant.name}")

        result = await session.execute(select(Entity).where(Entity.tenant_id == tenant.id, Entity.name == "Singapore HQ"))
        entity = result.scalar_one_or_none()
        if not entity:
            entity = Entity(
                tenant_id=tenant.id,
                name="Singapore HQ",
                uen="202412345G",
                gst_registered=False,
                payroll_cutoff_day=31,
                payment_day=7,
                work_week_hours=44.00,
                is_active=True
            )
            session.add(entity)
            await session.flush()
            
        result = await session.execute(select(Role).where(Role.tenant_id == tenant.id, Role.name == "HR Admin"))
        hr_admin_role = result.scalar_one_or_none()
        if not hr_admin_role:
            hr_admin_role = Role(tenant_id=tenant.id, name="HR Admin", description="Full access to HR features")
            session.add(hr_admin_role)
            await session.flush()
            # HR Admin gets all permissions
            for perm in Permission:
                session.add(RolePermission(role_id=hr_admin_role.id, permission=perm.value))
            await session.flush()

        # 3. Seed Tenant Admin User
        tenant_email = "cholan@ezy.sg"
        tenant_password = "Ezy@123"
        
        admin_result = await session.execute(select(User).where(User.email == tenant_email))
        tenant_admin = admin_result.scalar_one_or_none()
        
        if not tenant_admin:
            tenant_admin = User(
                tenant_id=tenant.id,
                email=tenant_email,
                password_hash=get_password_hash(tenant_password),
                full_name="Cholan Admin",
                is_tenant_admin=True,
                is_active=True
            )
            session.add(tenant_admin)
            await session.flush()
            
            # Associate user with the entity
            access = UserEntityAccess(
                user_id=tenant_admin.id,
                entity_id=entity.id,
                role_id=hr_admin_role.id
            )
            session.add(access)
            print(f"✅ Tenant Admin created: {tenant_email}")
        else:
            tenant_admin.password_hash = get_password_hash(tenant_password)
            print(f"🔄 Tenant Admin password updated: {tenant_email}")

        await session.commit()
        print("\n✨ Safe Seeding Complete! Passwords and users updated.")

if __name__ == "__main__":
    asyncio.run(seed_admins_only())
