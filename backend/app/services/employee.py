from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.employment import Person, Employment, BankAccount, Department
from app.schemas.employee import (
    EmployeeFullCreate, EmployeeSummary, EmployeeFullUpdate,
    EmployeeDetail, EmployeeDetailPerson, EmployeeDetailEmployment, EmployeeDetailBank
)
from app.core.security.encryption import encryptor
from datetime import date
from app.services.leave import LeaveService
import uuid


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

    async def create_employee(self, tenant_id: uuid.UUID, data: EmployeeFullCreate) -> Employment:
        # 1. Create Person
        person_dict = data.person.model_dump()
        raw_nric = person_dict.pop("nric_fin")
        person = Person(
            **person_dict,
            tenant_id=tenant_id,
            nric_fin=encryptor.encrypt(raw_nric)
        )
        self.db.add(person)
        await self.db.flush() # Get person.id

        # 2. Create Employment
        emp_dict = data.employment.model_dump()
        employment = Employment(
            **emp_dict,
            person_id=person.id
        )
        self.db.add(employment)
        await self.db.flush() # Get employment.id

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

        # 4. Grant Initial Leave Entitlements (Phase 2A)
        leave_service = LeaveService(self.db)
        await leave_service.grant_initial_entitlements(employment.id)

        await self.db.commit()
        await self.db.refresh(employment)
        return employment

    async def get_employees(self, entity_id: uuid.UUID, group_id: uuid.UUID = None) -> List[EmployeeSummary]:
        query = (
            select(Employment, Person, Department)
            .join(Person, Employment.person_id == Person.id)
            .outerjoin(Department, Employment.department_id == Department.id)
            .where(Employment.entity_id == entity_id)
        )
        if group_id:
            query = query.where(Employment.group_id == group_id)
        result = await self.db.execute(query)
        rows = result.all()
        
        summaries = []
        for emp, person, dept in rows:
            summaries.append(EmployeeSummary(
                id=emp.id,
                full_name=person.full_name,
                employee_code=emp.employee_code,
                job_title=emp.job_title,
                department_name=dept.name if dept else None,
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
            personal_email=person.personal_email,
            address=person.address,
        )

        employment_detail = EmployeeDetailEmployment(
            id=emp.id,
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
            join_date=emp.join_date,
            resign_date=emp.resign_date,
            probation_end_date=emp.probation_end_date,
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

        return EmployeeDetail(
            person=person_detail,
            employment=employment_detail,
            bank_account=bank_detail,
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
            # Handle NRIC re-encryption if provided
            if "nric_fin" in person_updates and person_updates["nric_fin"]:
                person_updates["nric_fin"] = encryptor.encrypt(person_updates["nric_fin"])
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

        await self.db.commit()
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
