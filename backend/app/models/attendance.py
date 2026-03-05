from sqlalchemy import Column, String, Boolean, DateTime, Date, Time, Text, ARRAY, Integer, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid
from .base import Base, IDMixin, TimestampMixin

class Shift(Base, IDMixin, TimestampMixin):
    __tablename__ = "shifts"

    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    start_time: Mapped[datetime.time] = mapped_column(Time, nullable=False)
    end_time: Mapped[datetime.time] = mapped_column(Time, nullable=False)
    break_minutes: Mapped[int] = mapped_column(Integer, default=60)
    work_hours: Mapped[float] = mapped_column(Numeric(4, 2), nullable=False)
    is_overnight: Mapped[bool] = mapped_column(Boolean, default=False)
    lateness_grace_minutes: Mapped[int] = mapped_column(Integer, default=5)
    early_exit_grace_minutes: Mapped[int] = mapped_column(Integer, default=0)
    late_penalty_rounding_block: Mapped[int] = mapped_column(Integer, default=0)
    early_penalty_rounding_block: Mapped[int] = mapped_column(Integer, default=0)
    offered_ot_1_5x: Mapped[float] = mapped_column(Numeric(4, 2), default=0.0)
    offered_ot_2_0x: Mapped[float] = mapped_column(Numeric(4, 2), default=0.0)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationship to break windows
    breaks = relationship("ShiftBreak", back_populates="shift", order_by="ShiftBreak.sort_order", cascade="all, delete-orphan", lazy="selectin")

class ShiftBreak(Base, IDMixin, TimestampMixin):
    __tablename__ = "shift_breaks"

    shift_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shifts.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[str] = mapped_column(String(50), nullable=False)  # "Lunch", "Dinner", "Breakfast"
    break_start: Mapped[datetime.time] = mapped_column(Time, nullable=False)
    break_end: Mapped[datetime.time] = mapped_column(Time, nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)  # If True, break is NOT deducted
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    shift = relationship("Shift", back_populates="breaks")

class ShiftRoster(Base, IDMixin, TimestampMixin):
    __tablename__ = "shift_roster"

    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id", ondelete="CASCADE"), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    roster_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    shift_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shifts.id"), nullable=True)
    day_type: Mapped[str] = mapped_column(String(20), default="normal")

    __table_args__ = (UniqueConstraint("employment_id", "roster_date", name="uq_shift_roster_date"),)

class AttendanceRecord(Base, IDMixin, TimestampMixin):
    __tablename__ = "attendance_records"

    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id", ondelete="CASCADE"), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    work_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    clock_in: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    clock_out: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(String(20), default="manual")
    is_approved: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("employment_id", "work_date", name="uq_attendance_record_date"),)

class DailyAttendance(Base, IDMixin, TimestampMixin):
    __tablename__ = "daily_attendance"

    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id", ondelete="CASCADE"), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    work_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    
    # Scheduled vs Actual
    scheduled_shift_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("shifts.id"), nullable=True)
    actual_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    scheduled_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    
    # Computed breakdown
    normal_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    ot_hours_1_5x: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    ot_hours_2x: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    
    # Exceptions
    is_absent: Mapped[bool] = mapped_column(Boolean, default=False)
    lateness_minutes: Mapped[int] = mapped_column(Integer, default=0)
    early_leave_minutes: Mapped[int] = mapped_column(Integer, default=0)
    
    # Manual Adjustments
    ot_adjustment_1_5x: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    ot_adjustment_2x: Mapped[float] = mapped_column(Numeric(5, 2), default=0.0)
    adjustment_reason: Mapped[str] = mapped_column(Text, nullable=True)
    calculation_log: Mapped[str] = mapped_column(Text, nullable=True)
    
    status: Mapped[str] = mapped_column(String(20), default="pending") # pending | approved | rejected

    __table_args__ = (UniqueConstraint("employment_id", "work_date", name="uq_daily_attendance_date"),)

class MonthlyOTSummary(Base, IDMixin, TimestampMixin):
    __tablename__ = "monthly_ot_summary"

    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    period: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    total_normal_hours: Mapped[float] = mapped_column(Numeric(7, 2), default=0.0)
    total_ot_hours: Mapped[float] = mapped_column(Numeric(7, 2), default=0.0)
    ot_hours_1_5x: Mapped[float] = mapped_column(Numeric(7, 2), default=0.0)
    ot_hours_2x: Mapped[float] = mapped_column(Numeric(7, 2), default=0.0)
    total_ot_pay: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    exceeds_72hr_limit: Mapped[bool] = mapped_column(Boolean, default=False)
    is_finalized: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("employment_id", "period", name="uq_monthly_ot_summary_period"),)

class PublicHoliday(Base, IDMixin, TimestampMixin):
    __tablename__ = "public_holidays"

    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    holiday_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    observed_date: Mapped[datetime.date] = mapped_column(Date, nullable=True)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (UniqueConstraint("entity_id", "holiday_date", name="uq_entity_holiday_date"),)
