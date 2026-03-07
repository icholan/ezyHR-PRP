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
from app.models.payroll import SalaryStructure

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
            from app.core.engines.cpf import cpf_engine
            rate_config = await cpf_engine.get_rates(
                db, 
                emp.citizenship_type, 
                age, 
                run.period
            )

            person_meta = {
                "citizenship_type": emp.citizenship_type,
                "age": age,
                "race": person.race,
                "religion": person.religion,
                "cpf_ee_rate": Decimal(str(rate_config.employee_rate)) if rate_config else Decimal("0.20"),
                "cpf_er_rate": Decimal(str(rate_config.employer_rate)) if rate_config else Decimal("0.17"),
                "ow_ceiling": Decimal(str(rate_config.ow_ceiling)) if rate_config else Decimal("6800.00"),
                "aw_ceiling": Decimal(str(rate_config.aw_ceiling_annual)) if rate_config else Decimal("102000.00")
            }
            
            ytd_meta = {"ytd_ow": Decimal("0"), "ytd_aw_calculated": Decimal("0")}

            # 2.5 Fetch Salary Structure Components
            as_of = run.period
            sc_result = await db.execute(
                select(SalaryStructure).where(
                    SalaryStructure.employment_id == emp.id,
                    SalaryStructure.effective_date <= as_of,
                    (SalaryStructure.end_date == None) | (SalaryStructure.end_date >= as_of)
                )
            )
            components = sc_result.scalars().all()
            
            allowances_total = Decimal("0")
            deductions_total = Decimal("0")
            breakdown = {"allowances": [], "deductions": []}
            
            for sc in components:
                amt = Decimal(str(sc.amount))
                if sc.category == "allowance":
                    allowances_total += amt
                    breakdown["allowances"].append({"name": sc.component, "amount": float(amt)})
                else:
                    deductions_total += amt
                    breakdown["deductions"].append({"name": sc.component, "amount": float(amt)})

            # 3. Execution
            calc_result = payroll_engine.calculate_employee_payroll(
                basic_salary=emp.basic_salary,
                allowances=allowances_total,
                deductions=deductions_total,
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
                other_deductions=float(deductions_total),
                fixed_allowances=float(allowances_total),
                breakdown=breakdown,
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
