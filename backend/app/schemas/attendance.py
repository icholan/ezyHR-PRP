from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date, time
import uuid

class ShiftBase(BaseModel):
    name: str
    start_time: time
    end_time: time
    break_minutes: int = 60
    work_hours: float
    is_overnight: bool = False
    lateness_grace_minutes: int = 5
    early_exit_grace_minutes: int = 0
    late_penalty_rounding_block: int = 0
    early_penalty_rounding_block: int = 0
    offered_ot_1_5x: float = 0.0
    offered_ot_2_0x: float = 0.0

# --- Shift Break Schemas ---
class ShiftBreakBase(BaseModel):
    label: str
    break_start: time
    break_end: time
    is_paid: bool = False
    sort_order: int = 0

class ShiftBreakCreate(ShiftBreakBase):
    pass

class ShiftBreakRead(ShiftBreakBase):
    id: uuid.UUID
    shift_id: uuid.UUID

    class Config:
        from_attributes = True

class ShiftCreate(ShiftBase):
    entity_id: uuid.UUID

class ShiftRead(ShiftBase):
    id: uuid.UUID
    entity_id: uuid.UUID
    breaks: List[ShiftBreakRead] = []

    class Config:
        from_attributes = True

class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    break_minutes: Optional[int] = None
    work_hours: Optional[float] = None
    is_overnight: Optional[bool] = None
    lateness_grace_minutes: Optional[int] = None
    early_exit_grace_minutes: Optional[int] = None
    late_penalty_rounding_block: Optional[int] = None
    early_penalty_rounding_block: Optional[int] = None
    offered_ot_1_5x: Optional[float] = None
    offered_ot_2_0x: Optional[float] = None

class ShiftRosterBase(BaseModel):
    roster_date: date
    shift_id: Optional[uuid.UUID] = None
    day_type: str = "normal" # normal | rest_day | public_holiday

class ShiftRosterCreate(ShiftRosterBase):
    employment_id: uuid.UUID
    entity_id: uuid.UUID

class ShiftRosterRead(ShiftRosterBase):
    id: uuid.UUID
    employment_id: uuid.UUID
    entity_id: uuid.UUID

    class Config:
        from_attributes = True

class RosterBulkUpdate(BaseModel):
    employment_ids: List[uuid.UUID]
    entity_id: uuid.UUID
    start_date: date
    end_date: date
    shift_id: Optional[uuid.UUID] = None
    day_type: Optional[str] = "normal"

class RosterAutoGenerate(BaseModel):
    entity_id: uuid.UUID
    employment_ids: List[uuid.UUID]
    start_date: date
    end_date: date
    shift_id: uuid.UUID

class RosterCellUpdate(BaseModel):
    shift_id: Optional[uuid.UUID] = None
    day_type: Optional[str] = None

class RosterClear(BaseModel):
    entity_id: uuid.UUID
    employment_ids: List[uuid.UUID]
    start_date: date
    end_date: date

class RosterReadEnriched(BaseModel):
    id: uuid.UUID
    employment_id: uuid.UUID
    entity_id: uuid.UUID
    roster_date: date
    shift_id: Optional[uuid.UUID] = None
    day_type: str = "normal"
    employee_name: str = ""
    shift_name: Optional[str] = None

    class Config:
        from_attributes = True

class AttendancePunch(BaseModel):
    entity_id: uuid.UUID
    employment_id: uuid.UUID
    punch_type: str = Field(..., pattern="^(in|out)$")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    source: str = "web"

class AttendanceRecordRead(BaseModel):
    id: uuid.UUID
    employment_id: uuid.UUID
    work_date: date
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    source: str
    is_approved: bool
    employee_name: Optional[str] = None
    attendance_roster_mode: Optional[str] = None

    class Config:
        from_attributes = True

class AttendanceRecordCreate(BaseModel):
    employment_id: uuid.UUID
    entity_id: uuid.UUID
    work_date: date
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    source: str = "manual"

class AttendanceRecordUpdate(BaseModel):
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    source: Optional[str] = None
    is_approved: Optional[bool] = None

class DailyAttendanceRead(BaseModel):
    id: uuid.UUID
    employment_id: uuid.UUID
    work_date: date
    actual_hours: float
    scheduled_hours: float
    normal_hours: float
    ot_hours_1_5x: float
    ot_hours_2x: float
    is_absent: bool
    lateness_minutes: int
    early_leave_minutes: int
    ot_adjustment_1_5x: float = 0.0
    ot_adjustment_2x: float = 0.0
    adjustment_reason: Optional[str] = None
    status: str
    calculation_log: Optional[str] = None
    employee_name: Optional[str] = None
    shift_name: Optional[str] = None

    class Config:
        from_attributes = True

class MonthlyOTSummaryRead(BaseModel):
    id: uuid.UUID
    employment_id: uuid.UUID
    period: date
    total_normal_hours: float
    total_ot_hours: float
    ot_hours_1_5x: float
    ot_hours_2x: float
    total_ot_pay: float
    exceeds_72hr_limit: bool
    is_finalized: bool

    class Config:
        from_attributes = True

# --- Public Holiday Schemas ---
class PublicHolidayCreate(BaseModel):
    entity_id: uuid.UUID
    name: str
    holiday_date: date
    observed_date: Optional[date] = None
    is_recurring: bool = False
    year: int

class PublicHolidayRead(BaseModel):
    id: uuid.UUID
    entity_id: uuid.UUID
    name: str
    holiday_date: date
    observed_date: Optional[date] = None
    is_recurring: bool = False
    year: int

    class Config:
        from_attributes = True

class PublicHolidayUpdate(BaseModel):
    name: Optional[str] = None
    holiday_date: Optional[date] = None
    observed_date: Optional[date] = None
    is_recurring: Optional[bool] = None

class PublicHolidaySeed(BaseModel):
    entity_id: uuid.UUID
    year: int
