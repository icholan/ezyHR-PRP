import uuid
from datetime import datetime, date
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, desc
from app.models.ket import KeyEmploymentTerm
from app.models.employment import Employment, Person, Department
from app.models.payroll import SalaryStructure
from app.models.tenant import Entity
from app.schemas.ket import KETDashboardResponse, KETSummary, KETRead

class KETService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_ket_dashboard(self, tenant_id: uuid.UUID) -> KETDashboardResponse:
        """Fetch all employees and their latest KET status."""
        # Get all active employments for this tenant
        # We join with Person for names and KeyEmploymentTerm for status
        # Since an employee might have multiple KET versions, we need the latest one
        
        # Subquery for latest KET version per employment
        latest_ket_sub = (
            select(
                KeyEmploymentTerm.employment_id,
                func.max(KeyEmploymentTerm.version).label("max_version")
            )
            .where(KeyEmploymentTerm.tenant_id == tenant_id)
            .group_by(KeyEmploymentTerm.employment_id)
            .subquery()
        )

        query = (
            select(
                Employment.id.label("employment_id"),
                Employment.employee_code,
                Employment.job_title,
                Person.full_name.label("employee_name"),
                KeyEmploymentTerm.id.label("ket_id"),
                KeyEmploymentTerm.status,
                KeyEmploymentTerm.version,
                KeyEmploymentTerm.updated_at
            )
            .join(Person, Employment.person_id == Person.id)
            .outerjoin(latest_ket_sub, Employment.id == latest_ket_sub.c.employment_id)
            .outerjoin(
                KeyEmploymentTerm,
                (KeyEmploymentTerm.employment_id == Employment.id) & 
                (KeyEmploymentTerm.version == latest_ket_sub.c.max_version)
            )
            .where(Employment.is_active == True)
            .where(Person.tenant_id == tenant_id)
        )

        result = await self.db.execute(query)
        rows = result.all()

        items = []
        stats = {"total": 0, "draft": 0, "issued": 0, "signed": 0, "pending": 0}

        for row in rows:
            stats["total"] += 1
            status = row.status or "pending"
            stats[status] += 1
            
            items.append(KETSummary(
                id=row.ket_id or uuid.uuid4(), # Placeholder if no KET yet
                employment_id=row.employment_id,
                employee_name=row.employee_name,
                employee_code=row.employee_code,
                job_title=row.job_title,
                status=status,
                version=row.version or 0,
                updated_at=row.updated_at or datetime.now()
            ))

        return KETDashboardResponse(stats=stats, items=items)

    async def generate_ket_snapshot(self, employment_id: uuid.UUID, tenant_id: uuid.UUID) -> KETRead:
        """Create a new KET version from current employment terms."""
        # 1. Fetch full details
        query = (
            select(Employment, Person, Entity)
            .join(Person, Employment.person_id == Person.id)
            .join(Entity, Employment.entity_id == Entity.id)
            .where(Employment.id == employment_id)
        )
        res = await self.db.execute(query)
        emp, person, entity = res.first()

        # Fetch salary components
        sc_res = await self.db.execute(
            select(SalaryStructure).where(SalaryStructure.employment_id == employment_id)
        )
        salary_components = sc_res.scalars().all()

        # 2. Build terms_json snapshot
        terms = {
            "employer": {
                "name": entity.name,
                "uen": entity.uen,
                "address": entity.registered_address
            },
            "employee": {
                "name": person.full_name,
                "nric_fin": "********", # Hidden for safety in snapshot metadata
                "address": person.address
            },
            "employment": {
                "job_title": emp.job_title,
                "job_responsibilities": emp.job_responsibilities,
                "join_date": str(emp.join_date),
                "employment_type": emp.employment_type,
                "probation_period": emp.probation_period,
                "notice_period": emp.notice_period,
                "work_location": emp.work_location or entity.registered_address
            },
            "working_hours": {
                "days_per_week": float(emp.working_days_per_week or 0),
                "hours_per_day": float(emp.work_hours_per_day or 0),
                "hours_per_week": float(emp.normal_work_hours_per_week or 0),
                "rest_day": emp.rest_day
            },
            "salary": {
                "basic_salary": float(emp.basic_salary),
                "salary_period": emp.salary_period,
                "payment_mode": emp.payment_mode,
                "is_ot_eligible": emp.is_ot_eligible,
                "ot_rate": float(emp.ot_rate or 0),
                "ot_payment_period": emp.ot_payment_period,
                "fixed_components": [
                    {"component": s.component, "amount": float(s.amount), "category": s.category}
                    for s in salary_components
                ]
            },
            "benefits": {
                "medical": emp.medical_benefits,
                "dental": emp.dental_benefits,
                "insurance": emp.insurance_benefits,
                "other": emp.other_benefits
            }
        }

        # 3. Determine version
        ver_query = select(func.max(KeyEmploymentTerm.version)).where(KeyEmploymentTerm.employment_id == employment_id)
        ver_res = await self.db.execute(ver_query)
        current_max = ver_res.scalar() or 0

        # 4. Save KET
        new_ket = KeyEmploymentTerm(
            employment_id=employment_id,
            tenant_id=tenant_id,
            status="draft",
            version=current_max + 1,
            terms_json=terms
        )
        self.db.add(new_ket)
        await self.db.commit()
        await self.db.refresh(new_ket)
        
        return KETRead.from_orm(new_ket)

    async def update_ket_status(self, ket_id: uuid.UUID, status: str, signed_by: Optional[uuid.UUID] = None) -> Optional[KeyEmploymentTerm]:
        """Progress KET status."""
        query = select(KeyEmploymentTerm).where(KeyEmploymentTerm.id == ket_id)
        res = await self.db.execute(query)
        ket = res.scalar_one_or_none()
        if not ket:
            return None
        
        ket.status = status
        if status == "issued":
            ket.issued_at = datetime.now()
        elif status == "signed":
            ket.signed_at = datetime.now()
            ket.signed_by_employee_id = signed_by
            
        await self.db.commit()
        return ket

    async def get_ket_detail(self, ket_id: uuid.UUID) -> Optional[KeyEmploymentTerm]:
        query = select(KeyEmploymentTerm).where(KeyEmploymentTerm.id == ket_id)
        res = await self.db.execute(query)
        return res.scalar_one_or_none()
