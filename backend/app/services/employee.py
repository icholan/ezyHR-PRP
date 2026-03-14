from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.employment import Person, Employment, BankAccount, Department, Group, Grade
from app.models.payroll import SalaryStructure
from app.models.auth import User, Role, UserEntityAccess
from app.core.security.auth import get_password_hash
from app.schemas.employee import (
    EmployeeFullCreate, EmployeeSummary, EmployeeFullUpdate,
    EmployeeDetail, EmployeeDetailPerson, EmployeeDetailEmployment, EmployeeDetailBank,
    SalaryComponentRead, PersonRead
)
from app.core.security.encryption import encryptor
from datetime import date
from app.services.leave import LeaveService
import uuid
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from app.services.audit import AuditService


class EmployeeService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def mask_nric(self, nric: str) -> str:
        if not nric: return "****"
        return "****" + nric[-4:]

    def mask_account(self, acct: str) -> str:
        if not acct or len(acct) < 4:
            return "****"
        return "****" + acct[-4:]

    async def is_nric_duplicate(self, tenant_id: uuid.UUID, nric: str) -> bool:
        """Check if NRIC hash exists for the tenant."""
        person = await self.get_person_by_nric(tenant_id, nric)
        return person is not None

    async def get_person_by_nric(self, tenant_id: uuid.UUID, nric: str) -> Optional[Person]:
        """Fetch Person by NRIC hash within a tenant."""
        if not nric:
            return None
        h = encryptor.get_hash(nric)
        query = select(Person).where(Person.tenant_id == tenant_id, Person.nric_fin_hash == h).limit(1)
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def is_employee_code_duplicate(self, entity_id: uuid.UUID, code: str) -> bool:
        """Check if employee code exists for the entity."""
        if not code:
            return False
        query = select(Employment.id).where(Employment.entity_id == entity_id, Employment.employee_code == code).limit(1)
        result = await self.db.execute(query)
        return result.scalar() is not None

    async def create_employee(self, tenant_id: uuid.UUID, data: EmployeeFullCreate, user_id: uuid.UUID = None, ip_address: str = None) -> Employment:
        # 1. Handle Person
        if data.person_id:
            person_result = await self.db.execute(select(Person).where(Person.id == data.person_id))
            person = person_result.scalar_one_or_none()
            if not person:
                raise HTTPException(status_code=404, detail="Selected person profile not found.")
        elif data.person:
            person_dict = data.person.model_dump()
            raw_nric = person_dict.pop("nric_fin")
            person = Person(
                **person_dict,
                tenant_id=tenant_id,
                nric_fin=encryptor.encrypt(raw_nric),
                nric_fin_hash=encryptor.get_hash(raw_nric)
            )
            self.db.add(person)
            try:
                await self.db.flush() # Get person.id
            except IntegrityError as e:
                await self.db.rollback()
                if "uq_persons_nric" in str(e):
                    raise HTTPException(status_code=400, detail="NRIC/FIN already exists for this tenant.")
                raise e
        else:
            raise HTTPException(status_code=400, detail="Either person data or person_id must be provided.")

        # 2. Create Employment
        emp_dict = data.employment.model_dump()
        employment = Employment(
            **emp_dict,
            person_id=person.id
        )
        self.db.add(employment)
        try:
            await self.db.flush() # Get employment.id
        except IntegrityError as e:
            await self.db.rollback()
            if "uq_employment_code" in str(e):
                raise HTTPException(status_code=400, detail=f"Employee Code '{employment.employee_code}' already exists for this entity.")
            raise e

        # 3. Create Bank Account (Optional)
        if data.bank_account:
            bank_dict = data.bank_account.model_dump()
            raw_acc = bank_dict.pop("account_number")
            bank_account = BankAccount(
                **bank_dict,
                person_id=person.id,
                account_number=encryptor.encrypt(raw_acc)
            )
            self.db.add(bank_account)
            await self.db.flush()
            # Update employment with bank_account_id
            employment.bank_account_id = bank_account.id

        # 3.5. Create Salary Components
        if data.salary_components:
            for comp in data.salary_components:
                sc = SalaryStructure(
                    employment_id=employment.id,
                    component=comp.component,
                    amount=comp.amount,
                    category=comp.category,
                    is_taxable=comp.is_taxable,
                    is_cpf_liable=comp.is_cpf_liable,
                    effective_date=comp.effective_date,
                    end_date=comp.end_date
                )
                self.db.add(sc)
            await self.db.flush()

        # 4. Grant Initial Leave Entitlements (Phase 2A)
        leave_service = LeaveService(self.db)
        await leave_service.grant_initial_entitlements(employment.id)

        # Log action
        await AuditService.log_action(
            db=self.db,
            action="INSERT",
            table_name="employments",
            record_id=employment.id,
            new_value=data.model_dump(mode='json'),
            user_id=user_id,
            tenant_id=tenant_id,
            entity_id=employment.entity_id,
            ip_address=ip_address
        )

        await self.db.commit()
        await self.db.refresh(employment)
        return employment

    async def get_primary_employment_id(self, person_id: uuid.UUID) -> Optional[uuid.UUID]:
        query = select(Employment.id).where(Employment.person_id == person_id, Employment.is_active == True).limit(1)
        res = await self.db.execute(query)
        return res.scalar_one_or_none()

    async def get_employees(
        self, 
        entity_id: uuid.UUID, 
        group_id: uuid.UUID = None,
        managed_group_ids: Optional[List[uuid.UUID]] = None,
        managed_dept_ids: Optional[List[uuid.UUID]] = None
    ) -> List[EmployeeSummary]:
        query = (
            select(Employment, Person, Department, Group, Grade)
            .join(Person, Employment.person_id == Person.id)
            .outerjoin(Department, Employment.department_id == Department.id)
            .outerjoin(Group, Employment.group_id == Group.id)
            .outerjoin(Grade, Employment.grade_id == Grade.id)
            .where(Employment.entity_id == entity_id)
        )
        
        if group_id:
            query = query.where(Employment.group_id == group_id)
            
        # Global Group/Dept Restrictions
        if managed_group_ids is not None:
            query = query.where(Employment.group_id.in_(managed_group_ids))
        if managed_dept_ids is not None:
            query = query.where(Employment.department_id.in_(managed_dept_ids))
            
        result = await self.db.execute(query)

        rows = result.all()
        
        summaries = []
        for emp, person, dept, grp, grd in rows:
            summaries.append(EmployeeSummary(
                id=emp.id,
                full_name=person.full_name,
                employee_code=emp.employee_code,
                job_title=emp.job_title,
                department_name=dept.name if dept else None,
                group_name=grp.name if grp else None,
                grade_name=grd.name if grd else None,
                is_active=emp.is_active,
                join_date=emp.join_date,
                person_id=person.id,
                citizenship_type=emp.citizenship_type,
                pr_year=emp.pr_year,
                work_pass_type=emp.work_pass_type,
                work_pass_no=emp.work_pass_no,
                work_pass_expiry=emp.work_pass_expiry
            ))
        return summaries

    async def get_employee_detail(self, employment_id: uuid.UUID) -> Optional[EmployeeDetail]:
        """Full detail view: Person + Employment + masked bank account."""
        query = (
            select(Employment, Person, Department, BankAccount)
            .join(Person, Employment.person_id == Person.id)
            .outerjoin(Department, Employment.department_id == Department.id)
            .outerjoin(BankAccount, Employment.bank_account_id == BankAccount.id)
            .where(Employment.id == employment_id)
        )
        result = await self.db.execute(query)
        row = result.first()
        if not row:
            return None

        emp, person, dept, bank = row

        # Decrypt + mask NRIC
        nric_masked = None
        if person.nric_fin:
            try:
                decrypted = encryptor.decrypt(person.nric_fin)
                nric_masked = self.mask_nric(decrypted)
            except Exception:
                nric_masked = "****"

        person_detail = EmployeeDetailPerson(
            id=person.id,
            full_name=person.full_name,
            nric_fin_last_4=nric_masked,
            nationality=person.nationality,
            race=person.race,
            religion=person.religion,
            date_of_birth=person.date_of_birth,
            gender=person.gender,
            contact_number=person.contact_number,
            mobile_number=person.mobile_number,
            whatsapp_number=person.whatsapp_number,
            personal_email=person.personal_email,
            language=person.language,
            highest_education=person.highest_education,
            pr_start_date=person.pr_start_date,
            work_pass_start=person.work_pass_start,
            address=person.address,
            emergency_contact_name=person.emergency_contact_name,
            emergency_contact_relationship=person.emergency_contact_relationship,
            emergency_contact_number=person.emergency_contact_number,
        )

        employment_detail = EmployeeDetailEmployment(
            id=emp.id,
            entity_id=emp.entity_id,
            employee_code=emp.employee_code,
            employment_type=emp.employment_type,
            job_title=emp.job_title,
            department_id=emp.department_id,
            department_name=dept.name if dept else None,
            grade_id=emp.grade_id,
            group_id=emp.group_id,
            citizenship_type=emp.citizenship_type,
            pr_year=emp.pr_year,
            work_pass_type=emp.work_pass_type,
            work_pass_no=emp.work_pass_no,
            work_pass_expiry=emp.work_pass_expiry,
            foreign_worker_levy=float(emp.foreign_worker_levy or 0),
            join_date=emp.join_date,
            resign_date=emp.resign_date,
            cessation_date=emp.cessation_date,
            probation_end_date=emp.probation_end_date,
            designation=emp.designation,
            working_days_per_week=float(emp.working_days_per_week) if emp.working_days_per_week else None,
            rest_day=emp.rest_day,
            work_hours_per_day=float(emp.work_hours_per_day) if emp.work_hours_per_day else None,
            normal_work_hours_per_week=float(emp.normal_work_hours_per_week) if emp.normal_work_hours_per_week else None,
            basic_salary=float(emp.basic_salary),
            payment_mode=emp.payment_mode,
            is_ot_eligible=emp.is_ot_eligible,
            ot_rate=float(emp.ot_rate or 1.5),
            salary_period=emp.salary_period or "monthly",
            ot_payment_period=emp.ot_payment_period or "monthly",
            job_responsibilities=emp.job_responsibilities,
            probation_period=emp.probation_period,
            notice_period=emp.notice_period,
            work_location=emp.work_location,
            medical_benefits=emp.medical_benefits,
            dental_benefits=emp.dental_benefits,
            insurance_benefits=emp.insurance_benefits,
            other_benefits=emp.other_benefits,
            is_active=emp.is_active,
        )

        bank_detail = None
        if bank:
            acct_masked = "****"
            if bank.account_number:
                try:
                    decrypted_acct = encryptor.decrypt(bank.account_number)
                    acct_masked = self.mask_account(decrypted_acct)
                except Exception:
                    acct_masked = "****"
            bank_detail = EmployeeDetailBank(
                id=bank.id,
                bank_name=bank.bank_name,
                account_name=bank.account_name,
                account_number_masked=acct_masked,
                is_default=bank.is_default,
            )

        # Fetch salary components
        sc_result = await self.db.execute(
            select(SalaryStructure).where(SalaryStructure.employment_id == employment_id)
        )
        salary_components = [
            SalaryComponentRead.model_validate(sc)
            for sc in sc_result.scalars().all()
        ]

        return EmployeeDetail(
            person=person_detail,
            employment=employment_detail,
            bank_account=bank_detail,
            salary_components=salary_components
        )

    async def update_employee(self, employment_id: uuid.UUID, data: EmployeeFullUpdate, user_id: uuid.UUID = None, ip_address: str = None) -> Optional[EmployeeDetail]:
        """Update person and/or employment fields."""
        # Fetch employment with person to get tenant_id and full state
        query = (
            select(Employment, Person)
            .join(Person, Employment.person_id == Person.id)
            .where(Employment.id == employment_id)
        )
        res = await self.db.execute(query)
        row = res.first()
        if not row:
            return None
        employment, person = row
        
        from app.services.audit import to_dict
        old_value_emp = to_dict(employment)
        old_value_person = to_dict(person)
        old_value = {"employment": old_value_emp, "person": old_value_person}
        tenant_id = person.tenant_id

        # Update Person fields
        if data.person:
            person_updates = data.person.model_dump(exclude_unset=True)
            # Handle NRIC re-encryption and hashing if provided
            if "nric_fin" in person_updates and person_updates["nric_fin"]:
                raw = person_updates["nric_fin"]
                person_updates["nric_fin"] = encryptor.encrypt(raw)
                person_updates["nric_fin_hash"] = encryptor.get_hash(raw)
            if person_updates:
                await self.db.execute(
                    update(Person).where(Person.id == employment.person_id).values(**person_updates)
                )

        # Update Employment fields
        if data.employment:
            emp_updates = data.employment.model_dump(exclude_unset=True)
            if emp_updates:
                await self.db.execute(
                    update(Employment).where(Employment.id == employment_id).values(**emp_updates)
                )

        # Log action
        await AuditService.log_action(
            db=self.db,
            action="UPDATE",
            table_name="employments",
            record_id=employment_id,
            old_value=old_value,
            new_value=data.model_dump(mode='json', exclude_unset=True),
            user_id=user_id,
            tenant_id=tenant_id,
            entity_id=employment.entity_id,
            ip_address=ip_address
        )

        # Update Bank Account
        if data.bank_account:
            bank_dict = data.bank_account.model_dump(exclude_unset=True)
            raw_acc = bank_dict.pop("account_number", None)
            
            if employment.bank_account_id:
                # Update existing
                if raw_acc:
                    bank_dict["account_number"] = encryptor.encrypt(raw_acc)
                await self.db.execute(
                    update(BankAccount).where(BankAccount.id == employment.bank_account_id).values(**bank_dict)
                )
            else:
                # Create new
                if not raw_acc:
                    raise HTTPException(status_code=400, detail="Account number is required for new bank account.")
                
                new_bank = BankAccount(
                    **bank_dict,
                    person_id=employment.person_id,
                    account_number=encryptor.encrypt(raw_acc)
                )
                self.db.add(new_bank)
                await self.db.flush()
                employment.bank_account_id = new_bank.id

        # Update Salary Components
        if data.salary_components is not None:
            # Simple sync: delete all and re-add (for now, can be optimized)
            # Delete existing
            from sqlalchemy import delete
            await self.db.execute(
                delete(SalaryStructure).where(SalaryStructure.employment_id == employment_id)
            )
            # Add new
            for comp in data.salary_components:
                sc = SalaryStructure(
                    employment_id=employment_id,
                    component=comp.component,
                    amount=comp.amount,
                    category=comp.category,
                    is_taxable=comp.is_taxable,
                    is_cpf_liable=comp.is_cpf_liable,
                    effective_date=comp.effective_date,
                    end_date=comp.end_date
                )
                self.db.add(sc)

        try:
            await self.db.commit()
        except IntegrityError as e:
            await self.db.rollback()
            msg = str(e)
            if "uq_persons_nric" in msg:
                raise HTTPException(status_code=400, detail="NRIC/FIN already exists for this tenant.")
            if "uq_employment_code" in msg:
                raise HTTPException(status_code=400, detail="Employee Code already exists for this entity.")
            raise e

        # Return updated detail
        return await self.get_employee_detail(employment_id)

    async def deactivate_employee(self, employment_id: uuid.UUID, user_id: uuid.UUID = None, ip_address: str = None) -> bool:
        """Soft delete: set is_active=False and resign_date=today."""
        # Fetch employment with person to get tenant_id
        query = (
            select(Employment, Person)
            .join(Person, Employment.person_id == Person.id)
            .where(Employment.id == employment_id)
        )
        res = await self.db.execute(query)
        row = res.first()
        if not row:
            return False
            
        employment, person = row
        
        from app.services.audit import to_dict
        old_value = to_dict(employment)
        tenant_id = person.tenant_id

        employment.is_active = False
        employment.resign_date = date.today()

        # Log action
        await AuditService.log_action(
            db=self.db,
            action="DELETE",
            table_name="employments",
            record_id=employment_id,
            old_value=old_value,
            new_value={"is_active": False, "resign_date": str(employment.resign_date)},
            user_id=user_id,
            tenant_id=tenant_id,
            entity_id=employment.entity_id,
            ip_address=ip_address
        )

        await self.db.commit()
        return True
    async def get_tenant_persons(self, tenant_id: uuid.UUID) -> List[PersonRead]:
        result = await self.db.execute(
            select(Person).where(Person.tenant_id == tenant_id)
        )
        persons = result.scalars().all()
        return [PersonRead.model_validate(p) for p in persons]

    async def get_person_employments(self, person_id: uuid.UUID) -> List[EmployeeSummary]:
        from app.models.tenant import Entity
        query = (
            select(Employment, Person, Department, Group, Grade, Entity)
            .join(Person, Employment.person_id == Person.id)
            .join(Entity, Employment.entity_id == Entity.id)
            .outerjoin(Department, Employment.department_id == Department.id)
            .outerjoin(Group, Employment.group_id == Group.id)
            .outerjoin(Grade, Employment.grade_id == Grade.id)
            .where(Employment.person_id == person_id)
        )
        result = await self.db.execute(query)
        rows = result.all()
        
        summaries = []
        for emp, person, dept, grp, grd, ent in rows:
            summaries.append(EmployeeSummary(
                id=emp.id,
                full_name=person.full_name,
                employee_code=emp.employee_code,
                job_title=emp.job_title,
                department_name=dept.name if dept else None,
                group_name=grp.name if grp else None,
                grade_name=grd.name if grd else None,
                is_active=emp.is_active,
                join_date=emp.join_date,
                person_id=person.id,
                entity_name=ent.name,
                citizenship_type=emp.citizenship_type,
                pr_year=emp.pr_year,
                work_pass_type=emp.work_pass_type,
                work_pass_no=emp.work_pass_no,
                work_pass_expiry=emp.work_pass_expiry
            ))
        return summaries

    async def get_person_by_id(self, person_id: uuid.UUID) -> Optional[PersonRead]:
        result = await self.db.execute(
            select(Person).where(Person.id == person_id)
        )
        person = result.scalar_one_or_none()
        if person:
            return PersonRead.model_validate(person)
        return None

    async def invite_to_app(self, person_id: uuid.UUID, tenant_id: uuid.UUID, admin_user_id: uuid.UUID, ip_address: str = None) -> str:
        """
        Creates a User account for an existing Person, granting them basic Employee access.
        Returns the generated temporary password.
        """
        import secrets
        import string

        # 1. Check if person exists and get email
        person_res = await self.db.execute(select(Person).where(Person.id == person_id, Person.tenant_id == tenant_id))
        person = person_res.scalar_one_or_none()
        
        if not person:
            raise HTTPException(status_code=404, detail="Employee record not found.")
            
        # 2. Get their active employment to find work email if any
        emp_res = await self.db.execute(
            select(Employment).where(Employment.person_id == person_id, Employment.is_active == True).limit(1)
        )
        employment = emp_res.scalar_one_or_none()
        
        email = None
        if employment and getattr(employment, 'work_email', None):
            email = employment.work_email
        else:
            email = getattr(person, 'personal_email', None)

        if not email:
            raise HTTPException(status_code=400, detail="Employee must have an email address to be invited.")

        # 3. Check if user already exists
        user_res = await self.db.execute(select(User).where(User.person_id == person_id))
        existing_user = user_res.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(status_code=400, detail="Employee already has portal access.")
            
        # 3. Check if email is globally in use
        email_res = await self.db.execute(select(User).where(User.email == email))
        if email_res.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="This email is already registered in the system.")

        # 4. Generate Temporary Password
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        temp_password = ''.join(secrets.choice(alphabet) for i in range(12))
        
        # 5. Create User
        user_id = uuid.uuid4()
        new_user = User(
            id=user_id,
            email=email,
            password_hash=get_password_hash(temp_password),
            full_name=person.full_name,
            tenant_id=tenant_id,
            person_id=person_id,
            is_tenant_admin=False,
            is_active=True
        )
        self.db.add(new_user)
        
        # 6. Grant Access to primary Entity using Employee Role
        if employment:
            # Find the "Employee" role for this tenant
            role_res = await self.db.execute(
                select(Role).where(Role.tenant_id == tenant_id, Role.name == "Employee").limit(1)
            )
            employee_role = role_res.scalar_one_or_none()
            
            if employee_role:
                access = UserEntityAccess(
                    user_id=user_id,
                    entity_id=employment.entity_id,
                    role_id=employee_role.id
                )
                self.db.add(access)
                
        # 7. Audit Log
        await AuditService.log_action(
            db=self.db,
            action="INVITE_TO_APP",
            table_name="users",
            record_id=user_id,
            new_value={"person_id": str(person_id), "email": email, "role": "Employee"},
            user_id=admin_user_id,
            tenant_id=tenant_id,
            entity_id=employment.entity_id if employment else None,
            ip_address=ip_address
        )
        
        await self.db.commit()
        
        return temp_password
