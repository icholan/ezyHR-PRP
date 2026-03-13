import uuid
from datetime import date
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.tenant import Tenant, Entity
from app.models.auth import User, Role, UserEntityAccess, RolePermission
from app.core.security.permissions import Permission
from app.core.security.auth import get_password_hash
from app.services.leave_seed import seed_default_leave_types_and_rules

class TenantProvisioningService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def provision_new_tenant(self, company_name: str, admin_name: str, admin_email: str, password: str) -> dict:
        """
        Atomically provisions a new SaaS Tenant.
        1. Creates Tenant
        2. Creates Main Entity
        3. Creates HR Admin User
        4. Seeds default Roles & Leave Rules
        """
        
        # 1. Create Tenant
        tenant_id = uuid.uuid4()
        tenant = Tenant(
            id=tenant_id,
            name=company_name,
            billing_email=admin_email,
            setup_complete=False # Requires onboarding wizard
        )
        self.db.add(tenant)

        # 2. Create foundational Entity
        entity_id = uuid.uuid4()
        entity = Entity(
            id=entity_id,
            tenant_id=tenant_id,
            name=company_name,
            payroll_cutoff_day=25, # Default, can be updated in wizard
            payment_day=28,
            attendance_roster_mode="manual"
        )
        self.db.add(entity)

        # Flush tenant & entity so FKs are ready
        await self.db.flush()

        # 3. Seed Default Roles and get Admin Role ID
        admin_role_id = await self._seed_default_roles(tenant_id=tenant.id)

        # 4. Create Admin User
        user_id = uuid.uuid4()
        admin_user = User(
            id=user_id,
            email=admin_email,
            full_name=admin_name,
            password_hash=get_password_hash(password),
            tenant_id=tenant_id,
            is_tenant_admin=True,
            is_active=True
        )
        self.db.add(admin_user)
        
        # 5. Connect User to Entity via UserEntityAccess
        access = UserEntityAccess(
            user_id=user_id,
            entity_id=entity_id,
            role_id=admin_role_id
        )
        self.db.add(access)

        # 6. Seed Compliance/Leave Defaults
        await seed_default_leave_types_and_rules(self.db, entity_id=entity.id)

        # Commit entire transaction
        await self.db.commit()
        
        return {
            "tenant_id": tenant.id,
            "entity_id": entity.id,
            "admin_user_id": admin_user.id
        }

    async def _seed_default_roles(self, tenant_id: uuid.UUID) -> uuid.UUID:
        # Admin Role
        admin_role_id = uuid.uuid4()
        admin_role = Role(
            id=admin_role_id,
            tenant_id=tenant_id,
            name="HR Admin",
            description="Full system access"
        )
        self.db.add(admin_role)
        
        # Admin Role Permissions
        for perm in Permission:
            self.db.add(RolePermission(role_id=admin_role_id, permission=perm.value))
        
        # Manager Role
        manager_role_id = uuid.uuid4()
        manager_role = Role(
            id=manager_role_id,
            tenant_id=tenant_id,
            name="Manager",
            description="Access to team management"
        )
        self.db.add(manager_role)
        
        manager_perms = [Permission.VIEW_EMPLOYEES, Permission.VIEW_ATTENDANCE, Permission.EDIT_ATTENDANCE, Permission.APPROVE_LEAVE, Permission.VIEW_LEAVE]
        for perm in manager_perms:
            self.db.add(RolePermission(role_id=manager_role_id, permission=perm.value))
        
        # Standard Employee Role
        employee_role_id = uuid.uuid4()
        employee_role = Role(
            id=employee_role_id,
            tenant_id=tenant_id,
            name="Employee",
            description="Standard employee access"
        )
        self.db.add(employee_role)
        
        employee_perms = [Permission.VIEW_LEAVE, Permission.VIEW_ATTENDANCE]
        for perm in employee_perms:
            self.db.add(RolePermission(role_id=employee_role_id, permission=perm.value))
            
        return admin_role_id
