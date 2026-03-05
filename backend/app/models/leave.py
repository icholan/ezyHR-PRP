from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, ARRAY, Integer, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date
import uuid
from .base import Base, IDMixin, TimestampMixin


# ─────────────────────────────────────────────
# Phase 1: DB-Driven Rules — Support Tables
# ─────────────────────────────────────────────

class LeavePool(Base, IDMixin, TimestampMixin):
    """
    Defines a shared-cap pool that groups multiple leave types.

    scope = 'employment' : cap is per individual employment (e.g. SICK+HOSP = 60 days)
    scope = 'family'     : cap shared across all persons in the same family_id (e.g. SPL)
    """
    __tablename__ = "leave_pools"

    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String(30), nullable=False)           # 'SICK_POOL', 'SPL_POOL'
    name: Mapped[str] = mapped_column(String(100), nullable=False)          # 'Sick & Hospitalisation Pool'
    cap_days: Mapped[float] = mapped_column(Numeric(6, 1), nullable=False)  # 60.0
    scope: Mapped[str] = mapped_column(String(20), nullable=False, default="employment")  # 'employment' | 'family'
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date] = mapped_column(Date, nullable=True)         # NULL = currently active
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("entity_id", "code", "effective_from", name="uq_leave_pool"),)


class StatutoryLeaveRule(Base, IDMixin, TimestampMixin):
    """
    Stores MOM step-tables as JSONB progression arrays.

    progression JSONB format:
        [{"min_tenure": 0, "days": 7}, {"min_tenure": 1, "days": 8}, ...]

    tenure_unit = 'months' (SICK, HOSP) or 'years' (ANNUAL)
    effective_from / effective_to allow retroactive rule history.
    Engine picks MAX(effective_from) WHERE effective_from <= leave.start_date.
    """
    __tablename__ = "statutory_leave_rules"

    leave_type_code: Mapped[str] = mapped_column(String(30), nullable=False)  # 'ANNUAL', 'SICK', 'HOSPITALISATION'
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date] = mapped_column(Date, nullable=True)           # NULL = currently active
    tenure_unit: Mapped[str] = mapped_column(String(10), nullable=False)      # 'months' | 'years'
    progression: Mapped[dict] = mapped_column(JSONB, nullable=False)          # step table
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("leave_type_code", "effective_from", name="uq_statutory_rule"),)


class LeaveTypePolicy(Base, IDMixin, TimestampMixin):
    """
    Per-entity override for statutory caps.
    If a row exists here, it takes precedence over StatutoryLeaveRule.
    Allows companies to be more generous than MOM minimum.
    e.g. Acme gives 18 days AL instead of MOM's 14.
    """
    __tablename__ = "leave_type_policies"

    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    leave_type_code: Mapped[str] = mapped_column(String(30), nullable=False)
    override_days: Mapped[float] = mapped_column(Numeric(6, 1), nullable=True)  # flat override cap
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date] = mapped_column(Date, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
class LeaveCarryPolicy(Base, IDMixin, TimestampMixin):
    """
    Defines rules for how unused leave is carried forward to the next year.
    max_carry_days: Maximum days allowed to be carried forward (e.g., 7).
    carry_expiry_months: How many months into the next year the carry-over is valid (e.g., 3 = March 31).
    """
    __tablename__ = "leave_carry_policies"

    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    leave_type_code: Mapped[str] = mapped_column(String(30), nullable=False)
    max_carry_days: Mapped[float] = mapped_column(Numeric(6, 1), nullable=False) # e.g. 7.0
    carry_expiry_months: Mapped[int] = mapped_column(Integer, nullable=True)     # e.g. 3 (expires Mar 31), NULL = no expiry
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)
    effective_to: Mapped[date] = mapped_column(Date, nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("entity_id", "leave_type_code", "effective_from", name="uq_leave_carry_policy"),)


# ─────────────────────────────────────────────
# Core Leave Tables (existing + pool_id added)
# ─────────────────────────────────────────────

class LeaveType(Base, IDMixin, TimestampMixin):
    __tablename__ = "leave_types"

    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)  # ANNUAL, SICK, CHILDCARE …
    is_paid: Mapped[bool] = mapped_column(Boolean, default=True)
    is_statutory: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str] = mapped_column(Text, nullable=True)

    # Phase 1: Pool membership
    pool_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leave_pools.id"), nullable=True)
    pool_sub_cap: Mapped[float] = mapped_column(Numeric(6, 1), nullable=True)  # e.g. 14.0 for SICK within 60-day pool

    pool: Mapped["LeavePool"] = relationship("LeavePool", lazy="selectin", foreign_keys=[pool_id])

    __table_args__ = (UniqueConstraint("entity_id", "code", name="uq_leave_type_code"),)


class LeaveEntitlement(Base, IDMixin, TimestampMixin):
    __tablename__ = "leave_entitlements"

    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id", ondelete="CASCADE"), nullable=False)
    leave_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leave_types.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    total_days: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)
    used_days: Mapped[float] = mapped_column(Numeric(4, 1), default=0.0)
    pending_days: Mapped[float] = mapped_column(Numeric(4, 1), default=0.0)
    carried_over_days: Mapped[float] = mapped_column(Numeric(4, 1), default=0.0)

    __table_args__ = (UniqueConstraint("employment_id", "leave_type_id", "year", name="uq_leave_entitlement_year"),)


class LeaveRequest(Base, IDMixin, TimestampMixin):
    __tablename__ = "leave_requests"

    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id", ondelete="CASCADE"), nullable=False)
    leave_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leave_types.id"), nullable=False)
    start_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    end_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    days_count: Mapped[float] = mapped_column(Numeric(4, 1), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | approved | rejected | cancelled
    attachment_url: Mapped[str] = mapped_column(String(500), nullable=True)
    child_birth_date: Mapped[date] = mapped_column(Date, nullable=True)  # Required for GPPL/SPL resolution
    child_order: Mapped[int] = mapped_column(Integer, nullable=True)      # Required for Maternity/GPML resolution
    approved_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str] = mapped_column(Text, nullable=True)
