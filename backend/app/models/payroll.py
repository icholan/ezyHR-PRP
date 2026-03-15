from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, ARRAY, Integer, ForeignKey, Numeric, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid
from .base import Base, IDMixin, TimestampMixin

class SalaryStructure(Base, IDMixin, TimestampMixin):
    __tablename__ = "salary_structures"

    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id", ondelete="CASCADE"), nullable=False)
    component: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    category: Mapped[str] = mapped_column(String(20), default="allowance") # allowance | deduction
    is_taxable: Mapped[bool] = mapped_column(Boolean, default=True)
    is_cpf_liable: Mapped[bool] = mapped_column(Boolean, default=True)
    effective_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    end_date: Mapped[datetime.date] = mapped_column(Date, nullable=True)

class PayrollRun(Base, IDMixin, TimestampMixin):
    __tablename__ = "payroll_runs"

    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    period: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    run_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    total_gross: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    total_cpf_ee: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    total_cpf_er: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    total_shg: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    total_sdl: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    total_fwl: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    total_net: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0)
    total_employees: Mapped[int] = mapped_column(Integer, default=0)
    ai_audit_run: Mapped[bool] = mapped_column(Boolean, default=False)
    ai_flags_count: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    group_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)

    __table_args__ = (UniqueConstraint("entity_id", "period", name="uq_payroll_runs_period"),)

class PayrollRecord(Base, IDMixin, TimestampMixin):
    __tablename__ = "payroll_records"

    payroll_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False)
    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    period: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    fixed_allowances: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    overtime_pay: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    bonus: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    commission: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    gross_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    ordinary_wage: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    additional_wage: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    cpf_employee: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    cpf_employer: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    cpf_oa: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    cpf_sa: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0) # SA or RA
    cpf_ma: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    shg_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    sdl_contribution: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    fwl_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    unpaid_leave_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    claims_reimbursement: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    other_deductions: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    net_salary: Mapped[float] = mapped_column(Numeric(12, 2), default=0.0)
    breakdown: Mapped[dict] = mapped_column(JSONB, nullable=True) # snapshot of allowances/deductions
    status: Mapped[str] = mapped_column(String(20), default="draft")

    __table_args__ = (UniqueConstraint("employment_id", "period", name="uq_payroll_records_period"),)

class AuditFlag(Base, IDMixin, TimestampMixin):
    __tablename__ = "audit_flags"

    payroll_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False)
    payroll_record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_records.id", ondelete="CASCADE"), nullable=True)
    flag_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # salary_anomaly | compliance_risk | ghost_employee
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str] = mapped_column(String(20), default="medium")
    # low | medium | high
    status: Mapped[str] = mapped_column(String(20), default="open")
    # open | dismissed | resolved
    resolved_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_notes: Mapped[str] = mapped_column(Text, nullable=True)

class PersonCPFSummary(Base, IDMixin, TimestampMixin):
    """
    Tracks Year-To-Date (YTD) CPF-liable wages for a person across a calendar year.
    Crucial for calculating the AW Ceiling: max(0, 102000 - YTD_OW).
    """
    __tablename__ = "person_cpf_summaries"

    person_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="CASCADE"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    
    ytd_ow: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0, nullable=False)
    ytd_aw: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0, nullable=False)
    ytd_cpf_ee: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0, nullable=False)
    ytd_cpf_er: Mapped[float] = mapped_column(Numeric(14, 2), default=0.0, nullable=False)
    
    last_updated_period: Mapped[datetime.date] = mapped_column(Date, nullable=True)

    __table_args__ = (UniqueConstraint("person_id", "year", name="uq_person_cpf_year"),)
