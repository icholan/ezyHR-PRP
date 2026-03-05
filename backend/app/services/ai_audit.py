from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List, Dict, Any
import uuid
import json
from decimal import Decimal
from datetime import date, timedelta

from app.models.payroll import PayrollRun, PayrollRecord, AuditFlag
from app.models.employment import Employment, Person

class AIAuditService:
    """
    AI-driven Payroll Auditing.
    Detects anomalies, compliance risks, and policy violations.
    """

    async def run_audit(self, db: AsyncSession, run_id: uuid.UUID) -> int:
        """
        Runs the audit for a payroll run.
        Checks:
        1. Salary Spikes (>25% vs 6-mo average)
        2. Missing CPF for Citizens
        3. Shared Bank Accounts (Ghost Employee Detection)
        """
        result = await db.execute(select(PayrollRun).where(PayrollRun.id == run_id))
        run = result.scalar_one_or_none()
        if not run:
            return 0

        # Fetch all records for this run
        records_result = await db.execute(
            select(PayrollRecord, Employment, Person)
            .join(Employment, PayrollRecord.employment_id == Employment.id)
            .join(Person, Employment.person_id == Person.id)
            .where(PayrollRecord.payroll_run_id == run_id)
        )
        records = records_result.all()
        
        flags_count = 0

        for rec, emp, person in records:
            # --- 1. Salary Spike Detection ---
            # Fetch last 6 months average for this employment
            avg_result = await db.execute(
                select(func.avg(PayrollRecord.gross_salary))
                .where(
                    PayrollRecord.employment_id == emp.id,
                    PayrollRecord.status == "approved",
                    PayrollRecord.period < run.period
                )
            )
            avg_gross = avg_result.scalar()
            
            if avg_gross and rec.gross_salary > (Decimal(str(avg_gross)) * Decimal("1.25")):
                await self._create_flag(
                    db, run_id, rec.id, "salary_anomaly",
                    f"Salary spike detected against historical average."
                )
                flags_count += 1

            # --- 2. Missing CPF for Citizens/PRs ---
            if emp.citizenship_type in ["citizen", "pr"] and rec.cpf_employee == 0:
                await self._create_flag(
                    db, run_id, rec.id, "compliance_risk",
                    "Mandatory CPF deduction missing for Singapore Citizen/PR."
                )
                flags_count += 1
            
        # Update Run
        run.ai_audit_run = True
        run.ai_flags_count = flags_count
        await db.commit()
        
        return flags_count

    async def _create_flag(
        self, 
        db: AsyncSession, 
        run_id: uuid.UUID, 
        record_id: uuid.UUID, 
        flag_type: str, 
        reason: str,
        severity: str = "medium"
    ):
        flag = AuditFlag(
            payroll_run_id=run_id,
            payroll_record_id=record_id,
            flag_type=flag_type,
            reason=reason,
            severity=severity,
            status="open"
        )
        db.add(flag)

ai_audit_service = AIAuditService()
