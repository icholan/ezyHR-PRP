from pydantic import BaseModel
from typing import List, Optional

class StatCard(BaseModel):
    label: str
    value: str
    change: str
    trend: str # 'up', 'down', or 'neutral'

class AuditFlag(BaseModel):
    type: str
    msg: str
    severity: str # 'high', 'medium', 'critical'

class ComplianceAlert(BaseModel):
    entity_id: str
    entity_name: str
    missing_fields: List[str]

class TimeSeriesPoint(BaseModel):
    label: str
    value: float

class HeadcountPoint(BaseModel):
    name: str # Department name
    value: int # Count

class ChartData(BaseModel):
    payroll_trends: List[TimeSeriesPoint]
    headcount_distribution: List[HeadcountPoint]

class DashboardOverview(BaseModel):
    stats: List[StatCard]
    audit_flags: List[AuditFlag]
    compliance_alerts: List[ComplianceAlert]
    charts: Optional[ChartData] = None


