from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.core.database import get_db
from app.api.v1.dependencies import get_current_user
from app.schemas.dashboard import DashboardOverview, StatCard, AuditFlag
from app.models.employment import Employment, Person
from app.models.leave import LeaveRequest
from app.models.system import SystemAuditLog

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/stats", response_model=DashboardOverview)
async def get_dashboard_stats(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get aggregated statistics and recent audit flags for the dashboard.
    """
    tenant_id = current_user.tenant_id
    
    # 1. Total Employees
    emp_count = await db.scalar(
        select(func.count(Employment.id))
        .join(Person, Employment.person_id == Person.id)
        .where(Person.tenant_id == tenant_id, Employment.is_active == True)
    )
    
    # 2. Pending Leave Requests
    leave_count = await db.scalar(
        select(func.count(LeaveRequest.id))
        .join(Employment, LeaveRequest.employment_id == Employment.id)
        .join(Person, Employment.person_id == Person.id)
        .where(Person.tenant_id == tenant_id, LeaveRequest.status.ilike("pending"))
    )
    
    # 3. Recent Audit Flags (Simulated AI Flags)
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
    
    return DashboardOverview(stats=stats, audit_flags=audit_flags)
