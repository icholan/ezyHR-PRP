from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.payroll import PayrollRun, PayrollRecord
from app.models import Employment, Person
from app.utils.generators.cpf91 import CPF91Generator
from app.utils.generators.ir8a import IR8AGenerator
from app.utils.generators.giro import GIROGenerator
import os
from datetime import date

class ReportingService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.cpf_gen = CPF91Generator()
        self.ir8a_gen = IR8AGenerator()
        self.giro_gen = GIROGenerator()

    async def generate_cpf91_report(self, entity_id: str, year: int, month: int):
        # 1. Fetch Entity for UEN
        from app.models.tenant import Entity
        entity_result = await self.db.execute(select(Entity).where(Entity.id == entity_id))
        entity = entity_result.scalar_one_or_none()
        if not entity:
            return None

        # 2. Fetch all payroll records for this entity and month
        target_period = date(year, month, 1)
        
        query = (
            select(PayrollRecord, Employment, Person)
            .join(Employment, PayrollRecord.employment_id == Employment.id)
            .join(Person, Employment.person_id == Person.id)
            .join(PayrollRun, PayrollRecord.payroll_run_id == PayrollRun.id)
            .where(
                PayrollRun.entity_id == entity_id,
                PayrollRun.period == target_period,
                PayrollRun.status == "approved"
            )
        )
        result = await self.db.execute(query)
        rows = result.all()

        if not rows:
            return None

        # 3. Company Info
        company_info = {
            "uen": entity.cpf_account_no or entity.uen or "123456789G",
            "payment_month": f"{year}{month:02d}"
        }

        # 4. Format employee data 
        employees = []
        for record, employment, person in rows:
            employees.append({
                "nric": person.nric_fin, # In real app, decrypt here
                "name": person.full_name,
                "ow": float(record.ordinary_wage),
                "aw": float(record.additional_wage),
                "ee_cpf": float(record.cpf_employee),
                "er_cpf": float(record.cpf_employer),
                "sdl": float(record.sdl_contribution or 0),
                "shg": float(record.shg_deduction or 0),
                "shg_type": record.breakdown.get("shg_type", "NONE") if record.breakdown else "NONE"
            })

        return self.cpf_gen.generate_file(company_info, employees).encode("utf-8")

    async def generate_ir8a_report(self, entity_id: str, year: int):
        # 1. Fetch Entity
        from app.models.tenant import Entity
        entity_result = await self.db.execute(select(Entity).where(Entity.id == entity_id))
        entity = entity_result.scalar_one_or_none()
        if not entity:
            return None

        # 2. Aggregate yearly data per employee
        # We need to sum records across all months in the target year
        query = (
            select(
                Person.full_name,
                Person.nric_fin,
                func.sum(PayrollRecord.gross_salary).label("total_gross"),
                func.sum(PayrollRecord.bonus).label("total_bonus"),
                func.sum(PayrollRecord.commission).label("total_commission"),
                func.sum(PayrollRecord.cpf_employee).label("total_ee_cpf"),
                func.sum(PayrollRecord.shg_deduction).label("total_shg")
            )
            .join(Employment, Employment.id == PayrollRecord.employment_id)
            .join(Person, Person.id == Employment.person_id)
            .join(PayrollRun, PayrollRun.id == PayrollRecord.payroll_run_id)
            .where(
                PayrollRun.entity_id == entity_id,
                PayrollRun.status == "approved",
                PayrollRun.period >= date(year, 1, 1),
                PayrollRun.period <= date(year, 12, 31)
            )
            .group_by(Person.id, Person.full_name, Person.nric_fin)
        )
        
        result = await self.db.execute(query)
        rows = result.all()

        if not rows:
            return None

        records = []
        for row in rows:
            records.append({
                "nric": row.nric_fin, # Decrypt in real app
                "name": row.full_name,
                "gross_salary": float(row.total_gross),
                "bonus": float(row.total_bonus),
                "director_fees": 0.0, # Placeholder
                "total_ee_cpf": float(row.total_ee_cpf),
                "total_shg": float(row.total_shg)
            })

        entity_info = {"uen": entity.uen or "123456789G", "name": entity.name}
        return self.ir8a_gen.generate_xml(entity_info, records)

    async def generate_leave_history_report(self, entity_id: str, year: int):
        import io
        import csv
        from app.models.leave import LeaveRequest, LeaveType
        from app.models.employment import Employment, Person

        # 1. Fetch all leave requests for the entity and year
        query = (
            select(
                Person.full_name,
                Employment.employee_code,
                LeaveType.name.label("leave_type_name"),
                LeaveRequest.start_date,
                LeaveRequest.end_date,
                LeaveRequest.days_count,
                LeaveRequest.status,
                LeaveRequest.child_birth_date,
                LeaveRequest.child_order
            )
            .join(Employment, Employment.id == LeaveRequest.employment_id)
            .join(Person, Person.id == Employment.person_id)
            .join(LeaveType, LeaveType.id == LeaveRequest.leave_type_id)
            .where(
                Employment.entity_id == entity_id,
                LeaveRequest.start_date >= date(year, 1, 1),
                LeaveRequest.start_date <= date(year, 12, 31)
            )
            .order_by(LeaveRequest.start_date.desc(), Person.full_name)
        )

        result = await self.db.execute(query)
        rows = result.all()

        if not rows:
            return None

        # 2. Write CSV
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Employee Name", "Employee Code", "Leave Type", 
            "Start Date", "End Date", "Days", "Status", 
            "Child Birth Date", "Child Order"
        ])

        for row in rows:
            writer.writerow([
                row.full_name,
                row.employee_code,
                row.leave_type_name,
                row.start_date.isoformat(),
                row.end_date.isoformat(),
                float(row.days_count),
                row.status,
                row.child_birth_date.isoformat() if row.child_birth_date else "",
                row.child_order if row.child_order else ""
            ])

        return output.getvalue().encode("utf-8")

    async def generate_giro_report(self, entity_id: str, year: int, month: int):
        from app.models.employment import BankAccount
        
        # 1. Fetch all payroll records for this entity and month
        target_period = date(year, month, 1)
        
        query = (
            select(PayrollRecord, Employment, Person, BankAccount)
            .join(Employment, PayrollRecord.employment_id == Employment.id)
            .join(Person, Employment.person_id == Person.id)
            .join(PayrollRun, PayrollRecord.payroll_run_id == PayrollRun.id)
            .outerjoin(BankAccount, Employment.bank_account_id == BankAccount.id)
            .where(
                PayrollRun.entity_id == entity_id,
                PayrollRun.period == target_period,
                PayrollRun.status == "approved"
            )
        )
        result = await self.db.execute(query)
        rows = result.all()

        if not rows:
            return None

        # 2. Format records for GIRO
        giro_records = []
        for record, employment, person, bank in rows:
            # Bank parsing: Usually "DBS 001-123456-7"
            # For this MVP, we'll try to split or use as is
            bank_name = bank.bank_name if bank else "CASH"
            account_no = bank.account_number if bank else "" 
            
            giro_records.append({
                "name": person.full_name,
                "bank_code": "", # Extract from bank_name if possible or store separately
                "branch_code": "",
                "account_no": account_no,
                "amount": float(record.net_salary),
                "description": f"SALARY {target_period.strftime('%b %Y')}"
            })

        return self.giro_gen.generate_csv(giro_records).encode("utf-8")
