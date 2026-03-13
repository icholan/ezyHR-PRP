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

class DashboardOverview(BaseModel):
    stats: List[StatCard]
    audit_flags: List[AuditFlag]
