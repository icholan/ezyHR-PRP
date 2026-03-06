from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid
from .base import Base, IDMixin, TimestampMixin

class KeyEmploymentTerm(Base, IDMixin, TimestampMixin):
    __tablename__ = "key_employment_terms"

    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id", ondelete="CASCADE"), nullable=False)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft | issued | signed | revoked
    version: Mapped[int] = mapped_column(Integer, default=1)
    
    # Snapshot of all mandatory fields at the time of issuance
    terms_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    signed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    signed_by_employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=True)
    
    employment = relationship("Employment")
