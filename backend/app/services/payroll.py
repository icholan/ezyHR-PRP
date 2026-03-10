from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import uuid
from datetime import date
from decimal import Decimal

from app.models.payroll import PayrollRun, PayrollRecord
from app.models.employment import Employment, Person
from app.core.engines.payroll_engine import payroll_engine
from app.core.engines.cpf import cpf_engine
from app.models.statutory import CPFRateConfig
from app.models.payroll import SalaryStructure, PersonCPFSummary
from app.models.leave import LeaveRequest, LeaveType
from app.models.attendance import MonthlyOTSummary
from app.services.leave import LeaveService
from app.services.audit import AuditService
import calendar

class PayrollService:
    """
    Handles higher-level payroll operations like Processing an entire Entity.
    """


    async def reverse_run_ytd(self, db: AsyncSession, run_id: uuid.UUID):
        """
        Subtracts the contributions of an existing run from the YTD summaries.
        Used before re-processing or deleting a run.
        """
        result = await db.execute(select(PayrollRun).where(PayrollRun.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            return

        existing_res = await db.execute(
            select(PayrollRecord, Employment)
            .join(Employment, PayrollRecord.employment_id == Employment.id)
            .where(PayrollRecord.payroll_run_id == run_id)
        )
        
        for rec, emp in existing_res.all():
            summary_res = await db.execute(
                select(PersonCPFSummary).where(
                    PersonCPFSummary.person_id == emp.person_id,
                    PersonCPFSummary.year == run.period.year
                )
            )
            summary = summary_res.scalar_one_or_none()
            if summary:
                summary.ytd_ow = float(summary.ytd_ow or 0) - float(rec.ordinary_wage or 0)
                summary.ytd_aw = float(summary.ytd_aw or 0) - float(rec.additional_wage or 0)
                summary.ytd_cpf_ee = float(summary.ytd_cpf_ee or 0) - float(rec.cpf_employee or 0)
                summary.ytd_cpf_er = float(summary.ytd_cpf_er or 0) - float(rec.cpf_employer or 0)

    async def delete_payroll_run(self, db: AsyncSession, run_id: uuid.UUID, user_id: uuid.UUID = None, ip_address: str = None):
        """
        Hard deletes a payroll run and all related records (via CASCADE).
        Reverses YTD summaries first.
        """
        from sqlalchemy import delete
        
        # 1. Reverse YTD
        await self.reverse_run_ytd(db, run_id)
        
        # 2. Delete the run (CASCADE handles records, flags, etc.)
        await db.execute(delete(PayrollRun).where(PayrollRun.id == run_id))
        
        # Audit Log
        # Get tenant_id from Entity
        from app.models.tenant import Entity
        result_run = await db.execute(select(PayrollRun).where(PayrollRun.id == run_id))
        run_obj = result_run.scalar_one_or_none()
        
        if run_obj:
            from app.services.audit import to_dict
            old_value = to_dict(run_obj)
            
            stmt_ent = select(Entity.tenant_id).where(Entity.id == run_obj.entity_id)
            tenant_id = (await db.execute(stmt_ent)).scalar()

            await AuditService.log_action(
                db=db,
                action="DELETE",
                table_name="payroll_runs",
                record_id=run_id,
                old_value=old_value,
                user_id=user_id,
                tenant_id=tenant_id,
                ip_address=ip_address
            )

        await db.commit()

    async def process_entity_payroll(
        self,
        db: AsyncSession,
        run_id: uuid.UUID,
        user_id: uuid.UUID = None,
        ip_address: str = None
    ) -> int:
        """
        Iterates through all active employments for the entity and generates records.
        """
        result = await db.execute(select(PayrollRun).where(PayrollRun.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            return 0

        # Delete existing draft records to allow re-processing
        from sqlalchemy import delete
        
        # --- REFACTORED: Use reverse_run_ytd ---
        await self.reverse_run_ytd(db, run_id)
        
        await db.execute(delete(PayrollRecord).where(PayrollRecord.payroll_run_id == run_id))
        await db.flush() 

        # 0. Automated Attendance Processing (Pre-compute day-by-day and monthly rollup)
        from app.services.attendance import AttendanceService
        att_service = AttendanceService(db)
        await att_service.compute_monthly_attendance(run.entity_id, run.period)

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
        total_cpf_ee = Decimal("0")
        total_cpf_er = Decimal("0")
        total_shg = Decimal("0")
        total_sdl = Decimal("0")

        for emp, person in employments:
            # 2. Collect metadata for calculations
            # Fetch Person YTD Summary for the current year
            summary_res = await db.execute(
                select(PersonCPFSummary).where(
                    PersonCPFSummary.person_id == person.id,
                    PersonCPFSummary.year == run.period.year
                )
            )
            summary = summary_res.scalar_one_or_none()
            if not summary:
                summary = PersonCPFSummary(person_id=person.id, year=run.period.year)
                db.add(summary)
            
            ytd_meta = {
                "ytd_ow": Decimal(str(summary.ytd_ow or 0)),
                "ytd_aw_calculated": Decimal(str(summary.ytd_aw or 0))
            }

            # Simple Age Calculation
            today = run.period # Better to use run period for historical accuracy
            age = today.year - person.date_of_birth.year - ((today.month, today.day) < (person.date_of_birth.month, person.date_of_birth.day))

            # Fetch Allocation Ratios
            alloc_config = await cpf_engine.get_allocations(db, age, run.period)
            cpf_allocations = None
            if alloc_config:
                cpf_allocations = {
                    "oa": Decimal(str(alloc_config.oa_ratio or 0)),
                    "sa": Decimal(str(alloc_config.sa_ratio or 0)),
                    "ma": Decimal(str(alloc_config.ma_ratio or 0))
                }

            # Lookup Statutory Rates for this age/period
            rate_config = await cpf_engine.get_rates(db, emp.citizenship_type, age, run.period)
            
            # Default rates if not found (fallback to 2024 standards but log warning)
            ee_rate = Decimal(str(rate_config.employee_rate)) if rate_config else Decimal("0.20")
            er_rate = Decimal(str(rate_config.employer_rate)) if rate_config else Decimal("0.17")
            ow_ceil = Decimal(str(rate_config.ow_ceiling)) if rate_config else Decimal("6800.00")
            aw_ceil_ann = Decimal(str(rate_config.aw_ceiling_annual)) if rate_config else Decimal("102000.00")

            person_meta = {
                "citizenship_type": emp.citizenship_type,
                "age": age,
                "race": person.race,
                "religion": person.religion,
                "cpf_ee_rate": ee_rate,
                "cpf_er_rate": er_rate,
                "ow_ceiling": ow_ceil,
                "aw_ceiling": aw_ceil_ann,
                "cpf_allocations": cpf_allocations
            }
            
            # 2.5 Fetch Salary Structure Components
            # (OT & Leave should also be fetched here eventually)
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

            # 2.6 Fetch Unpaid Leave Days
            _, last_day = calendar.monthrange(run.period.year, run.period.month)
            period_start = run.period.replace(day=1)
            period_end = run.period.replace(day=last_day)
            
            leave_stmt = select(LeaveRequest, LeaveType).join(LeaveType).where(
                LeaveRequest.employment_id == emp.id,
                LeaveRequest.status == "approved",
                LeaveType.is_paid == False,
                LeaveRequest.start_date <= period_end,
                LeaveRequest.end_date >= period_start
            )
            leave_res = await db.execute(leave_stmt)
            unpaid_days = Decimal("0")
            leave_svc = LeaveService(db)
            
            for req, lt in leave_res.all():
                overlap_start = max(req.start_date, period_start)
                overlap_end = min(req.end_date, period_end)
                # Count working days in the overlapping segment
                days = await leave_svc.count_working_days(
                    emp.entity_id,
                    overlap_start,
                    overlap_end,
                    emp.rest_day
                )
                if days > 0:
                    unpaid_days += Decimal(str(days))
                    breakdown["deductions"].append({
                        "name": f"Unpaid Leave ({req.start_date} to {req.end_date})", 
                        "amount": float(emp.basic_salary / 22 * Decimal(str(days))) # placeholder for audit visibility
                    })

            # 2.7 Fetch OT Summary
            ot_stmt = select(MonthlyOTSummary).where(
                MonthlyOTSummary.employment_id == emp.id,
                MonthlyOTSummary.period == run.period
            )
            ot_summary = (await db.execute(ot_stmt)).scalar_one_or_none()
            ot_15 = Decimal(str(ot_summary.ot_hours_1_5x)) if ot_summary else Decimal("0")
            ot_20 = Decimal(str(ot_summary.ot_hours_2x)) if ot_summary else Decimal("0")

            # 2.8 Calculate AWS (13th Month) - Triggered in December
            aws_amount = Decimal("0")
            if run.period.month == 12:
                # Pro-rata calculation
                if emp.join_date.year < run.period.year:
                    service_months = 12
                elif emp.join_date.year == run.period.year:
                    # Joined this year: 12 - month + 1
                    service_months = 12 - emp.join_date.month + 1
                else:
                    service_months = 0 # Future join? Should not happen for active
                
                if service_months > 0:
                    aws_amount = (emp.basic_salary / Decimal("12") * Decimal(str(service_months))).quantize(Decimal("0.01"))
                    breakdown["allowances"].append({
                        "name": f"AWS (13th Month) - {service_months}/12 pro-rata",
                        "amount": float(aws_amount)
                    })

            # 3. Execution
            calc_result = payroll_engine.calculate_employee_payroll(
                basic_salary=emp.basic_salary,
                ot_hours_1_5x=ot_15,
                ot_hours_2x=ot_20,
                allowances=allowances_total,
                deductions=deductions_total,
                bonus=aws_amount, # AWS is an Additional Wage (AW)
                unpaid_leave_days=unpaid_days,
                working_days_in_month=22, # Default for MOM standard
                person_meta=person_meta,
                ytd_meta=ytd_meta
            )

            # 4. Save Record
            alloc_split = person_meta.get("computed_allocation", {})
            record = PayrollRecord(
                payroll_run_id=run.id,
                employment_id=emp.id,
                entity_id=run.entity_id,
                period=run.period,
                basic_salary=calc_result["basic_salary"],
                overtime_pay=calc_result["earnings"]["ot_pay"],
                bonus=calc_result["earnings"]["bonus"],
                gross_salary=calc_result["summary"]["gross_pay"],
                # Standardize OW/AW fields for reporting
                ordinary_wage=calc_result["summary"]["ow_total"],
                additional_wage=calc_result["summary"]["aw_total"],
                cpf_employee=calc_result["deductions"]["cpf_employee"],
                cpf_employer=calc_result["contributions"]["cpf_employer"],
                cpf_oa=alloc_split.get("oa", 0),
                cpf_sa=alloc_split.get("sa", 0),
                cpf_ma=alloc_split.get("ma", 0),
                shg_deduction=calc_result["deductions"]["shg"],
                sdl_contribution=calc_result["contributions"]["sdl"],
                net_salary=calc_result["summary"]["net_pay"],
                other_deductions=float(deductions_total),
                fixed_allowances=float(allowances_total),
                breakdown={
                    **breakdown,
                    "shg_type": calc_result["deductions"]["shg_type"],
                    "hourly_rate": float(calc_result["hourly_rate"]),
                    "ot_1_5": {
                        "hours": float(calc_result["earnings"]["ot_1_5_hours"]),
                        "amount": float(calc_result["earnings"]["ot_1_5_pay"])
                    },
                    "ot_2_0": {
                        "hours": float(calc_result["earnings"]["ot_2_0_hours"]),
                        "amount": float(calc_result["earnings"]["ot_2_0_pay"])
                    }
                },
                status="draft"
            )
            
            db.add(record)

            # Update YTD Summary
            summary.ytd_ow = float(summary.ytd_ow or 0) + float(calc_result["summary"]["ow_total"] or 0)
            summary.ytd_aw = float(summary.ytd_aw or 0) + float(calc_result["summary"]["aw_total"] or 0)
            summary.ytd_cpf_ee = float(summary.ytd_cpf_ee or 0) + float(calc_result["deductions"]["cpf_employee"] or 0)
            summary.ytd_cpf_er = float(summary.ytd_cpf_er or 0) + float(calc_result["contributions"]["cpf_employer"] or 0)
            summary.last_updated_period = run.period

            total_gross += calc_result["summary"]["gross_pay"]
            total_net += calc_result["summary"]["net_pay"]
            total_cpf_ee += calc_result["deductions"]["cpf_employee"]
            total_cpf_er += calc_result["contributions"]["cpf_employer"]
            total_shg += calc_result["deductions"]["shg"]
            total_sdl += calc_result["contributions"]["sdl"]
            processed_count += 1

        # 5. Update Run Totals
        run.total_gross = total_gross
        run.total_net = total_net
        run.total_cpf_ee = total_cpf_ee
        run.total_cpf_er = total_cpf_er
        run.total_shg = total_shg
        run.total_sdl = total_sdl
        run.total_employees = processed_count
        run.status = "processed"
        
        # Audit Log
        # Get tenant_id from Entity
        from app.models.tenant import Entity
        stmt_ent = select(Entity.tenant_id).where(Entity.id == run.entity_id)
        tenant_id = (await db.execute(stmt_ent)).scalar()

        await AuditService.log_action(
            db=db,
            action="UPDATE",
            table_name="payroll_runs",
            record_id=run_id,
            old_value={"status": "draft"},
            new_value={"status": "processed", "records_count": processed_count},
            user_id=user_id,
            tenant_id=tenant_id,
            ip_address=ip_address
        )

        await db.commit()
        return processed_count

payroll_service = PayrollService()
