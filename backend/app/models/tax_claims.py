from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, Integer, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
import uuid
from .base import Base, IDMixin, TimestampMixin

class IR8ARecord(Base, IDMixin, TimestampMixin):
    __tablename__ = "ir8a_records"

    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    year_of_assessment: Mapped[int] = mapped_column(Integer, nullable=False)
    gross_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    bonus: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    total_income: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    submission_status: Mapped[str] = mapped_column(String(20), default="draft")
    ai_precheck_done: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_precheck_flags: Mapped[dict] = mapped_column(JSONB, nullable=True)

    __table_args__ = (UniqueConstraint("employment_id", "year_of_assessment", name="uq_ir8a_period"),)

class ClaimApplication(Base, IDMixin, TimestampMixin):
    __tablename__ = "claim_applications"

    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id", ondelete="CASCADE"), nullable=False)
    claim_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    approved_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    paid_in_period: Mapped[datetime.date] = mapped_column(Date, nullable=True)

class WorkPass(Base, IDMixin, TimestampMixin):
    __tablename__ = "work_passes"

    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id", ondelete="CASCADE"), nullable=False)
    pass_type: Mapped[str] = mapped_column(String(50), nullable=False)
    pass_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=True)
    expiry_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active")
    renewal_submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
