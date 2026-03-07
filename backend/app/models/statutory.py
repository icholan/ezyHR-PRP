from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, ARRAY, Integer, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid
from .base import Base, IDMixin, TimestampMixin

class CPFRateConfig(Base, IDMixin, TimestampMixin):
    __tablename__ = "cpf_rate_config"

    citizenship_type: Mapped[str] = mapped_column(String(20), nullable=False)
    age_from: Mapped[int] = mapped_column(Integer, nullable=False)
    age_to: Mapped[int] = mapped_column(Integer, nullable=False)
    employee_rate: Mapped[float] = mapped_column(Numeric(6, 5), nullable=False)
    employer_rate: Mapped[float] = mapped_column(Numeric(6, 5), nullable=False)
    ow_ceiling: Mapped[float] = mapped_column(Numeric(10, 2), default=6800.00)
    aw_ceiling_annual: Mapped[float] = mapped_column(Numeric(10, 2), default=102000.00)
    effective_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    end_date: Mapped[datetime.date] = mapped_column(Date, nullable=True)
    is_expired: Mapped[bool] = mapped_column(Boolean, default=False)

class CPFSubmission(Base, IDMixin, TimestampMixin):
    __tablename__ = "cpf_submissions"

    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    period: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    due_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    submission_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    cpf91_file_url: Mapped[str] = mapped_column(String(500), nullable=True)
    total_employee_cpf: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    total_employer_cpf: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    total_sdl: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    iras_ref: Mapped[str] = mapped_column(String(50), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("entity_id", "period", name="uq_cpf_submissions_period"),)

class SHGRateConfig(Base, IDMixin, TimestampMixin):
    __tablename__ = "shg_rate_config"

    shg_type: Mapped[str] = mapped_column(String(20), nullable=False)
    wage_from: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    wage_to: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    deduction_amount: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    effective_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    end_date: Mapped[datetime.date] = mapped_column(Date, nullable=True)
    is_expired: Mapped[bool] = mapped_column(Boolean, default=False)

class SDLRateConfig(Base, IDMixin, TimestampMixin):
    __tablename__ = "sdl_rate_config"

    rate: Mapped[float] = mapped_column(Numeric(6, 5), default=0.00250)
    min_amount: Mapped[float] = mapped_column(Numeric(8, 2), default=2.00)
    max_amount: Mapped[float] = mapped_column(Numeric(8, 2), default=11.25)
    effective_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    end_date: Mapped[datetime.date] = mapped_column(Date, nullable=True)
