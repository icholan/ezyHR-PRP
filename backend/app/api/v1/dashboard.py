from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.core.database import get_db
from typing import List, Optional
import uuid
from app.api.v1.dependencies import get_current_user
from app.schemas.dashboard import DashboardOverview, StatCard, AuditFlag, ComplianceAlert
from app.models.employment import Employment, Person
from app.models.leave import LeaveRequest
from app.models.system import SystemAuditLog
from app.models.tenant import Entity
from app.models.attendance import Shift
from app.models.payroll import PayrollRun
from app.models.employment import Department

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardOverview)
async def get_dashboard_stats(
    entity_id: Optional[uuid.UUID] = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get aggregated statistics, audit flags, and compliance alerts for the dashboard.
    """
    tenant_id = current_user.tenant_id
    
    # 1. Total Employees
    emp_stmt = select(func.count(Employment.id)).join(Person, Employment.person_id == Person.id)
    emp_stmt = emp_stmt.where(Person.tenant_id == tenant_id, Employment.is_active == True)
    if entity_id:
        emp_stmt = emp_stmt.where(Employment.entity_id == entity_id)
    
    emp_count = await db.scalar(emp_stmt)
    
    # 2. Pending Leave Requests
    leave_stmt = select(func.count(LeaveRequest.id)).join(Employment, LeaveRequest.employment_id == Employment.id)
    leave_stmt = leave_stmt.join(Person, Employment.person_id == Person.id)
    leave_stmt = leave_stmt.where(Person.tenant_id == tenant_id, LeaveRequest.status.ilike("pending"))
    if entity_id:
        leave_stmt = leave_stmt.where(Employment.entity_id == entity_id)
        
    leave_count = await db.scalar(leave_stmt)
    
    # 3. Compliance Checks (Validate Entities)
    # For tenant admins, we check ALL entities regardless of the selected entity_id
    ent_stmt = select(Entity).where(Entity.tenant_id == tenant_id, Entity.is_active == True)
    if entity_id and not current_user.is_tenant_admin:
        ent_stmt = ent_stmt.where(Entity.id == entity_id)
        
    entities_result = await db.execute(ent_stmt)
    entities = entities_result.scalars().all()
    
    compliance_alerts = []
    for ent in entities:
        missing = []
        if not ent.uen: missing.append("Company UEN")
        if not ent.cpf_account_no: missing.append("CPF Submission No")
        if not ent.registered_address: missing.append("Registered Address")
        
        # Banking/Payroll details
        bank_fields = {
            "bank_name": "Bank Name",
            "bank_account_no": "Bank Account No",
            "bank_account_name": "Bank Account Name",
            "bank_branch_code": "Bank Branch Code"
        }
        for field, label in bank_fields.items():
            if not getattr(ent, field):
                missing.append(label)
        
        # Smart-Match Shift Check
        if ent.attendance_roster_mode == 'smart_match':
            shift_count = await db.scalar(
                select(func.count(Shift.id))
                .where(Shift.entity_id == ent.id, Shift.is_deleted == False)
            )
            if not shift_count:
                missing.append("Shift Configuration (At least one shift required for Smart-Match)")
        
        if missing:

            compliance_alerts.append(ComplianceAlert(
                entity_id=str(ent.id),
                entity_name=ent.name,
                missing_fields=missing
            ))

    # 4. Recent Audit Flags (Simulated AI Flags)
    audit_results = await db.execute(
        select(SystemAuditLog)
        .where(SystemAuditLog.tenant_id == tenant_id)
        .where(SystemAuditLog.action.in_(["LOGIN", "LOGOUT", "DELETE", "UPDATE"]))
        .order_by(desc(SystemAuditLog.created_at))
        .limit(4)
    )
    audit_logs = audit_results.scalars().all()
    
    audit_flags = []
    for log in audit_logs:
        severity = "medium"
        if log.action in ["LOGIN", "LOGOUT"]:
            severity = "medium"
            msg = f"User {log.action.lower()} detected via {log.ip_address}"
        elif log.action in ["DELETE"]:
            severity = "critical"
            msg = "Critical data deletion requested"
        else:
            severity = "high"
            msg = "Data modification detected"
            
        audit_flags.append(AuditFlag(
            type=log.action,
            msg=msg,
            severity=severity
        ))
        
    stats = [
        StatCard(
            label="Total Employees", 
            value=str(emp_count or 0), 
            change="+0", 
            trend="neutral"
        ),
        StatCard(
            label="Active Payroll", 
            value="$0", # Placeholder for phase 1 
            change="0%", 
            trend="neutral"
        ),
        StatCard(
            label="Pending Leaves", 
            value=str(leave_count or 0), 
            change="", 
            trend="neutral"
        ),
        StatCard(
            label="Recent Events", 
            value=str(len(audit_logs)), 
            change="Last 24h", 
            trend="neutral"
        )
    ]
    
    # 5. Chart Data (Payroll Trends & Headcount)
    # 5a. Payroll Trends (Last 6 months)
    payroll_trends = []
    from datetime import date, timedelta
    today = date.today()
    for i in range(5, -1, -1):
        # Rough month-by-month start
        m_start = (today.replace(day=1) - timedelta(days=i*30)).replace(day=1)
        m_end = (m_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        
        ptr_stmt = select(func.sum(PayrollRun.total_gross)).join(Entity, PayrollRun.entity_id == Entity.id)
        ptr_stmt = ptr_stmt.where(
            Entity.tenant_id == tenant_id,
            PayrollRun.period >= m_start,
            PayrollRun.period <= m_end,
            PayrollRun.status == "paid"
        )
        if entity_id:
            ptr_stmt = ptr_stmt.where(PayrollRun.entity_id == entity_id)
            
        m_total = await db.scalar(ptr_stmt) or 0.0
        payroll_trends.append({"label": m_start.strftime("%b %y"), "value": float(m_total)})

    # 5b. Headcount Distribution (By Department)
    headcount_distribution = []
    dist_stmt = (
        select(Department.name, func.count(Employment.id))
        .join(Employment, Employment.department_id == Department.id)
        .join(Entity, Department.entity_id == Entity.id)
        .where(Entity.tenant_id == tenant_id, Employment.is_active == True)
        .group_by(Department.name)
    )
    if entity_id:
        dist_stmt = dist_stmt.where(Employment.entity_id == entity_id)
        
    dist_results = await db.execute(dist_stmt)
    for dept_name, count in dist_results.all():
        headcount_distribution.append({"name": dept_name, "value": count})

    # Add uncategorized if any
    un_stmt = (
        select(func.count(Employment.id))
        .join(Person, Employment.person_id == Person.id)
        .where(
            Person.tenant_id == tenant_id, 
            Employment.is_active == True,
            Employment.department_id == None
        )
    )
    if entity_id:
        un_stmt = un_stmt.where(Employment.entity_id == entity_id)
    
    un_count = await db.scalar(un_stmt)
    if un_count:
        headcount_distribution.append({"name": "Uncategorized", "value": un_count})

    return DashboardOverview(
        stats=stats, 
        audit_flags=audit_flags,
        compliance_alerts=compliance_alerts,
        charts={
            "payroll_trends": payroll_trends,
            "headcount_distribution": headcount_distribution
        }
    )

