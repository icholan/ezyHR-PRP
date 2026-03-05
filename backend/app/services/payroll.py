from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import uuid
from datetime import date
from decimal import Decimal

from app.models.payroll import PayrollRun, PayrollRecord
from app.models.employment import Employment, Person
from app.core.engines.payroll_engine import payroll_engine
from app.models.statutory import CPFRateConfig

class PayrollService:
    """
    Handles higher-level payroll operations like Processing an entire Entity.
    """

    async def process_entity_payroll(
        self,
        db: AsyncSession,
        run_id: uuid.UUID
    ) -> int:
        """
        Iterates through all active employments for the entity and generates records.
        """
        result = await db.execute(select(PayrollRun).where(PayrollRun.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            return 0

        # 1. Fetch active employments
        emp_result = await db.execute(
            select(Employment, Person).join(Person).where(
                Employment.entity_id == run.entity_id,
                Employment.is_active == True,
                Employment.join_date <= run.period
            )
        )
        employments = emp_result.all()

        processed_count = 0
        total_gross = Decimal("0")
        total_net = Decimal("0")

        for emp, person in employments:
            # 2. Collect metadata for calculations
            # TODO: Fetch specific YTD totals from person_cpf_summary
            # TODO: Fetch Leave and OT hours for the period
            
            # Simple Age Calculation
            today = date.today()
            age = today.year - person.date_of_birth.year - ((today.month, today.day) < (person.date_of_birth.month, person.date_of_birth.day))

            # Fetch rates based on age and citizenship
            # (Simplified for now, using standard 20/17 rates)
            person_meta = {
                "citizenship_type": emp.citizenship_type,
                "age": age,
                "race": person.race,
                "religion": person.religion,
                "cpf_ee_rate": Decimal("0.20"),
                "cpf_er_rate": Decimal("0.17")
            }
            
            ytd_meta = {"ytd_ow": Decimal("0"), "ytd_aw_calculated": Decimal("0")}

            # 3. Execution
            calc_result = payroll_engine.calculate_employee_payroll(
                basic_salary=emp.basic_salary,
                person_meta=person_meta,
                ytd_meta=ytd_meta
            )

            # 4. Save Record
            record = PayrollRecord(
                payroll_run_id=run.id,
                employment_id=emp.id,
                entity_id=run.entity_id,
                period=run.period,
                basic_salary=calc_result["basic_salary"],
                overtime_pay=calc_result["earnings"]["ot_pay"],
                bonus=calc_result["earnings"]["bonus"],
                gross_salary=calc_result["summary"]["gross_pay"],
                cpf_employee=calc_result["deductions"]["cpf_employee"],
                cpf_employer=calc_result["contributions"]["cpf_employer"],
                shg_deduction=calc_result["deductions"]["shg"],
                sdl_contribution=calc_result["contributions"]["sdl"],
                net_salary=calc_result["summary"]["net_pay"],
                status="draft"
            )
            
            db.add(record)
            total_gross += calc_result["summary"]["gross_pay"]
            total_net += calc_result["summary"]["net_pay"]
            processed_count += 1

        # 5. Update Run Totals
        run.total_gross = total_gross
        run.total_net = total_net
        run.status = "processed"
        
        await db.commit()
        return processed_count

payroll_service = PayrollService()
