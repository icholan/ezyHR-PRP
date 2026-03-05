from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
from enum import Enum

class ReportType(str, Enum):
    CPF91 = "CPF91"
    IR8A = "IR8A"
    LEAVE_HISTORY = "LEAVE_HISTORY"

class ReportRequest(BaseModel):
    entity_id: str
    report_type: ReportType
    year: int
    month: Optional[int] = None  # Required for CPF91
    advice_code: str = Field(default="01", description="Submission advice code (e.g., 01 for normal)")

class ReportResponse(BaseModel):
    file_name: str
    download_url: str
    generated_at: str
    metadata: dict
