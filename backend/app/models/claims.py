import uuid
from datetime import date, datetime
from typing import Optional
from sqlalchemy import String, Boolean, ForeignKey, Numeric, Text, Date, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, IDMixin, TimestampMixin

class ClaimCategory(Base, IDMixin, TimestampMixin):
    __tablename__ = "claim_categories"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False, index=True)
    
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class ClaimRequest(Base, IDMixin, TimestampMixin):
    __tablename__ = "claim_requests"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("claim_categories.id"), nullable=False)
    
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    claim_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending") # pending | approved | rejected | paid
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    payroll_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    category: Mapped["ClaimCategory"] = relationship()
    receipts: Mapped[list["ClaimReceipt"]] = relationship(back_populates="claim", cascade="all, delete-orphan")

class ClaimReceipt(Base, IDMixin, TimestampMixin):
    __tablename__ = "claim_receipts"

    claim_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("claim_requests.id", ondelete="CASCADE"), nullable=False, index=True)
    receipt_url: Mapped[str] = mapped_column(String(512), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)

    claim: Mapped["ClaimRequest"] = relationship(back_populates="receipts")
