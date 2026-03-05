import asyncio
import os
import sys
import uuid
from datetime import date

# Add the backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal, engine
from app.models.base import Base # Import Base to create tables
import app.models # Register all models with Base
from app.models.tenant import PlatformAdmin, Tenant, Entity
from app.models.employment import Person, Employment
from app.models.auth import User, UserEntityAccess, Role, RolePermission
from app.core.security.permissions import Permission
from app.models.payroll import PayrollRun, PayrollRecord
from app.models.attendance import Shift, ShiftRoster, AttendanceRecord
from app.models.leave import LeaveType, LeaveEntitlement, LeaveRequest
from app.core.security.auth import get_password_hash, generate_mfa_secret
from sqlalchemy import select, and_
from datetime import date, datetime, timedelta, time

async def seed_all():
    print("🚀 Starting Development Data Seeding...")
    
    # NEW: Create tables if they don't exist
    print("🛠️  Initializing database tables...")
    async with engine.begin() as conn:
        # For dev: drop tables to sync columns if changed
        from app.models.payroll import PayrollRun, PayrollRecord, AuditFlag
        from app.models.ai import AIAuditFlag, AIAttritionScore, AIChatSession
        from app.models.leave import LeaveType, LeaveEntitlement, LeaveRequest
        from app.models.system import SystemAuditLog, AuditLog
        from sqlalchemy import text
        # Drop tables using CASCADE to prevent dependency errors
        tables = [
            "leave_applications", "leave_requests", "leave_entitlements", "leave_types",
            "ai_attrition_scores", "ai_audit_flags", "ai_chat_sessions", "audit_flags",
            "payroll_records", "payroll_runs", "system_audit_logs", "audit_logs",
            "role_permissions", "roles", "user_entity_access"
        ]
        for table in tables:
            await conn.execute(text(f"DROP TABLE IF EXISTS {table} CASCADE"))
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables initialized.")

    async with AsyncSessionLocal() as session:
        # 1. Seed Platform Super Admin
        result = await session.execute(select(PlatformAdmin).where(PlatformAdmin.email == "admin@yourhrms.com"))
        admin = result.scalar_one_or_none()
        if not admin:
            mfa_secret = "JBSWY3DPEHPK3PXP" # Static for dev testing: 'Base32'
            admin = PlatformAdmin(
                email="admin@yourhrms.com",
                password_hash=get_password_hash("Admin@123"),
                full_name="System Super Admin",
                role="super_admin",
                mfa_secret=mfa_secret,
                mfa_enabled=True,
                is_active=True
            )
            session.add(admin)
            print("✅ Platform Admin created: admin@yourhrms.com / Admin@123")
        else:
            admin.password_hash = get_password_hash("Admin@123")
            print("🔄 Platform Admin password updated.")

        # 2. Seed a Tenant (Company)
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
        else:
            print(f"⏭️ Tenant {tenant.name} already exists.")

        # 3. Seed an Entity (Branch)
        result = await session.execute(select(Entity).where(Entity.tenant_id == tenant.id, Entity.name == "Singapore HQ"))
        entity = result.scalar_one_or_none()
        if not entity:
            entity = Entity(
                tenant_id=tenant.id,
                name="Singapore HQ",
                uen="202412345G",
                is_active=True
            )
            session.add(entity)
            await session.flush()
            print(f"✅ Entity created: {entity.name} (UEN: {entity.uen})")
        else:
            print(f"⏭️ Entity {entity.name} already exists.")

        # 3.5 Seed Default Roles
        result = await session.execute(select(Role).where(Role.tenant_id == tenant.id, Role.name == "HR Admin"))
        hr_admin_role = result.scalar_one_or_none()
        if not hr_admin_role:
            hr_admin_role = Role(tenant_id=tenant.id, name="HR Admin", description="Full access to HR features")
            manager_role = Role(tenant_id=tenant.id, name="Manager", description="Access to team management")
            employee_role = Role(tenant_id=tenant.id, name="Employee", description="Basic self-service access")
            session.add_all([hr_admin_role, manager_role, employee_role])
            await session.flush()
            
            # HR Admin gets all permissions
            for perm in Permission:
                session.add(RolePermission(role_id=hr_admin_role.id, permission=perm.value))
                
            # Manager gets view employees, view/edit attendance, approve leave
            manager_perms = [Permission.VIEW_EMPLOYEES, Permission.VIEW_ATTENDANCE, Permission.EDIT_ATTENDANCE, Permission.APPROVE_LEAVE, Permission.VIEW_LEAVE]
            for perm in manager_perms:
                session.add(RolePermission(role_id=manager_role.id, permission=perm.value))
                
            # Employee gets basic
            employee_perms = [Permission.VIEW_LEAVE, Permission.VIEW_ATTENDANCE]
            for perm in employee_perms:
                session.add(RolePermission(role_id=employee_role.id, permission=perm.value))
                
            await session.flush()
            print("✅ Default Custom Roles and Permissions seeded.")
        else:
            result = await session.execute(select(Role).where(Role.tenant_id == tenant.id, Role.name == "Manager"))
            manager_role = result.scalar_one()
            result = await session.execute(select(Role).where(Role.tenant_id == tenant.id, Role.name == "Employee"))
            employee_role = result.scalar_one()

        # 4. Seed a Tenant Admin User
        admin_result = await session.execute(select(User).where(User.email == "hrmanager@acme.com"))
        tenant_admin = admin_result.scalar_one_or_none()
        if not tenant_admin:
            tenant_admin = User(
                tenant_id=tenant.id,
                email="hrmanager@acme.com",
                password_hash=get_password_hash("Manager@123"),
                full_name="Alex Cholan",
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
            print("✅ Tenant Admin created: hrmanager@acme.com / Manager@123")
        else:
            tenant_admin.password_hash = get_password_hash("Manager@123")
            print("🔄 Tenant Admin password updated.")

        # 5. Seed Employee Data
        person_result = await session.execute(select(Person).where(Person.full_name == "Tan Wei Ming"))
        person = person_result.scalar_one_or_none()
        if not person:
            person = Person(
                tenant_id=tenant.id,
                full_name="Tan Wei Ming",
                nric_fin="S1234567A",
                nationality="Singaporean",
                gender="Male",
                date_of_birth=date(1990, 1, 1)
            )
            session.add(person)
            await session.flush()
            
            employment = Employment(
                person_id=person.id,
                entity_id=entity.id,
                employee_code="EMP001",
                employment_type="full_time",
                job_title="Software Engineer",
                join_date=date(2023, 1, 1),
                basic_salary=4500.00,
                is_active=True
            )
            session.add(employment)
            await session.flush()
            print(f"✅ Employee seeded: {person.full_name}")
        else:
            employment_result = await session.execute(select(Employment).where(Employment.person_id == person.id))
            employment = employment_result.scalar_one()

        # 6. Seed Payroll Data
        today = date.today()
        this_month = date(today.year, today.month, 1)
        last_month = (this_month - timedelta(days=1)).replace(day=1)

        # check if payroll run exists for this month
        payroll_result = await session.execute(select(PayrollRun).where(PayrollRun.entity_id == entity.id, PayrollRun.period == this_month))
        if not payroll_result.scalar_one_or_none():
            run1 = PayrollRun(
                entity_id=entity.id,
                period=this_month,
                status="draft",
                total_gross=12500.00,
                total_net=10250.00,
                total_cpf_ee=2125.00,
                total_cpf_er=2125.00,
                total_shg=15.00,
                total_sdl=32.00,
                total_employees=2,
                ai_audit_run=False
            )
            session.add(run1)
            
            # Historical Run
            run2 = PayrollRun(
                entity_id=entity.id,
                period=last_month,
                status="approved",
                total_gross=12000.00,
                total_net=9800.00,
                total_cpf_ee=2040.00,
                total_cpf_er=2040.00,
                total_shg=15.00,
                total_sdl=30.00,
                total_employees=2,
                ai_audit_run=True,
                ai_flags_count=0
            )
            session.add(run2)
            await session.flush()

            # Seed another employee
            person2_result = await session.execute(select(Person).where(Person.nric_fin == "S7654321B"))
            person2 = person2_result.scalar_one_or_none()
            if not person2:
                person2 = Person(
                    tenant_id=tenant.id,
                    full_name="Lim Mei Hua",
                    nric_fin="S7654321B",
                    nationality="Singaporean",
                    gender="Female",
                    date_of_birth=date(1992, 5, 20)
                )
                session.add(person2)
                await session.flush()
            
            emp2_result = await session.execute(select(Employment).where(Employment.person_id == person2.id))
            emp2 = emp2_result.scalar_one_or_none()
            if not emp2:
                emp2 = Employment(
                    person_id=person2.id,
                    entity_id=entity.id,
                    employee_code="EMP002",
                    employment_type="full_time",
                    job_title="HR Specialist",
                    join_date=date(2023, 6, 1),
                    basic_salary=3500.00,
                    is_active=True
                )
                session.add(emp2)
                await session.flush()

            # Seed some records for the historical run
            rec1 = PayrollRecord(
                payroll_run_id=run2.id,
                employment_id=employment.id,
                entity_id=entity.id,
                period=last_month,
                basic_salary=4500.00,
                gross_salary=4500.00,
                net_salary=3735.00,
                cpf_employee=765.00,
                cpf_employer=765.00,
                shg_deduction=5.00,
                sdl_contribution=10.00,
                status="approved"
            )
            session.add(rec1)

            rec2 = PayrollRecord(
                payroll_run_id=run2.id,
                employment_id=emp2.id,
                entity_id=entity.id,
                period=last_month,
                basic_salary=3500.00,
                gross_salary=3500.00,
                net_salary=2890.00,
                cpf_employee=595.00,
                cpf_employer=595.00,
                shg_deduction=5.00,
                sdl_contribution=10.00,
                status="approved"
            )
            session.add(rec2)
            # 7. Seed Attendance Data (Phase 10)
            shift_9to6 = Shift(
                entity_id=entity.id,
                name="Standard Office (9-6)",
                start_time=time(9, 0),
                end_time=time(18, 0),
                break_minutes=60,
                work_hours=8.0,
                is_overnight=False
            )
            session.add(shift_9to6)
            await session.flush()
            
            # Add roster for both employees for today
            ros_stmt1 = select(ShiftRoster).where(
                and_(
                    ShiftRoster.employment_id == employment.id,
                    ShiftRoster.roster_date == today
                )
            )
            if not (await session.execute(ros_stmt1)).scalar_one_or_none():
                roster1 = ShiftRoster(
                    employment_id=employment.id,
                    entity_id=entity.id,
                    roster_date=today,
                    shift_id=shift_9to6.id,
                    day_type="normal"
                )
                session.add(roster1)

            ros_stmt2 = select(ShiftRoster).where(
                and_(
                    ShiftRoster.employment_id == emp2.id,
                    ShiftRoster.roster_date == today
                )
            )
            if not (await session.execute(ros_stmt2)).scalar_one_or_none():
                roster2 = ShiftRoster(
                    employment_id=emp2.id,
                    entity_id=entity.id,
                    roster_date=today,
                    shift_id=shift_9to6.id,
                    day_type="normal"
                )
                session.add(roster2)
            
            # Seed a manual record for yesterday for emp1 (to test calculation)
            yesterday = today - timedelta(days=1)
            ros_stmt = select(ShiftRoster).where(
                and_(
                    ShiftRoster.employment_id == employment.id,
                    ShiftRoster.roster_date == yesterday
                )
            )
            ros_check = await session.execute(ros_stmt)
            if not ros_check.scalar_one_or_none():
                roster_yest = ShiftRoster(
                    employment_id=employment.id,
                    entity_id=entity.id,
                    roster_date=yesterday,
                    shift_id=shift_9to6.id,
                    day_type="normal"
                )
                session.add(roster_yest)
            
            att_stmt = select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.employment_id == employment.id,
                    AttendanceRecord.work_date == yesterday
                )
            )
            att_check = await session.execute(att_stmt)
            if not att_check.scalar_one_or_none():
                att_yest = AttendanceRecord(
                    employment_id=employment.id,
                    entity_id=entity.id,
                    work_date=yesterday,
                    clock_in=datetime.combine(yesterday, time(9, 0)),
                    clock_out=datetime.combine(yesterday, time(19, 30)), # 10.5 hours gross, 9.5 net, 1.5 OT
                    source="manual",
                    is_approved=True
                )
                session.add(att_yest)
            
            print("✅ Shift, Roster and Attendance seeded.")

            # 8. Seed Leave Data (Phase 11)
            annual_leave = LeaveType(
                entity_id=entity.id,
                name="Annual Leave",
                code="ANNUAL",
                is_paid=True,
                is_statutory=True
            )
            sick_leave = LeaveType(
                entity_id=entity.id,
                name="Sick Leave",
                code="SICK",
                is_paid=True,
                is_statutory=True
            )
            session.add(annual_leave)
            session.add(sick_leave)
            await session.flush()

            # Entitlement for Primary Employee
            ent1 = LeaveEntitlement(
                employment_id=employment.id,
                leave_type_id=annual_leave.id,
                year=2026,
                total_days=14.0,
                used_days=2.0,
                pending_days=0.0
            )
            # Seed a past request to match used_days
            req1 = LeaveRequest(
                employment_id=employment.id,
                leave_type_id=annual_leave.id,
                start_date=date(2026, 2, 1),
                end_date=date(2026, 2, 2),
                days_count=2.0,
                status="approved",
                reason="Rest and relax"
            )
            session.add(ent1)
            session.add(req1)
            
            print("✅ Leave Types and Entitlements seeded.")
            print("✅ Sample Payroll runs and 2 employees seeded.")

        await session.commit()
        print("\n✨ Seeding Complete! You can now log in to the UI.")

if __name__ == "__main__":
    asyncio.run(seed_all())
