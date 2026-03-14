from pydantic import BaseModel
from typing import List

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

class DashboardOverview(BaseModel):
    stats: List[StatCard]
    audit_flags: List[AuditFlag]
    compliance_alerts: List[ComplianceAlert]


