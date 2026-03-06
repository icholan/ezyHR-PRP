from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.employment import Person, Employment, BankAccount, Department, Group, Grade
from app.models.payroll import SalaryStructure
from app.schemas.employee import (
    EmployeeFullCreate, EmployeeSummary, EmployeeFullUpdate,
    EmployeeDetail, EmployeeDetailPerson, EmployeeDetailEmployment, EmployeeDetailBank,
    SalaryComponentRead
)
from app.core.security.encryption import encryptor
from datetime import date
from app.services.leave import LeaveService
import uuid
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException


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
        if not nric:
            return False
        h = encryptor.get_hash(nric)
        query = select(Person.id).where(Person.tenant_id == tenant_id, Person.nric_fin_hash == h).limit(1)
        result = await self.db.execute(query)
        return result.scalar() is not None

    async def is_employee_code_duplicate(self, entity_id: uuid.UUID, code: str) -> bool:
        """Check if employee code exists for the entity."""
        if not code:
            return False
        query = select(Employment.id).where(Employment.entity_id == entity_id, Employment.employee_code == code).limit(1)
        result = await self.db.execute(query)
        return result.scalar() is not None

    async def create_employee(self, tenant_id: uuid.UUID, data: EmployeeFullCreate) -> Employment:
        # 1. Create Person
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

        await self.db.commit()
        await self.db.refresh(employment)
        return employment

    async def get_employees(self, entity_id: uuid.UUID, group_id: uuid.UUID = None) -> List[EmployeeSummary]:
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
                person_id=person.id
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

    async def update_employee(self, employment_id: uuid.UUID, data: EmployeeFullUpdate) -> Optional[EmployeeDetail]:
        """Update person and/or employment fields."""
        # Fetch employment to get person_id
        emp_result = await self.db.execute(
            select(Employment).where(Employment.id == employment_id)
        )
        employment = emp_result.scalar_one_or_none()
        if not employment:
            return None

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

    async def deactivate_employee(self, employment_id: uuid.UUID) -> bool:
        """Soft delete: set is_active=False and resign_date=today."""
        result = await self.db.execute(
            select(Employment).where(Employment.id == employment_id)
        )
        employment = result.scalar_one_or_none()
        if not employment:
            return False

        employment.is_active = False
        employment.resign_date = date.today()
        await self.db.commit()
        return True
