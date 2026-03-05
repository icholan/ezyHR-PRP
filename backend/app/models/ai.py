from sqlalchemy import Column, String, Boolean, DateTime, Date, Text, Integer, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
import uuid
from .base import Base, IDMixin, TimestampMixin

class AIAuditFlag(Base, IDMixin, TimestampMixin):
    __tablename__ = "ai_audit_flags"

    payroll_run_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False)
    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("payroll_records.id"), nullable=True)
    flag_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(10), default="medium")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    ai_reasoning: Mapped[str] = mapped_column(Text, nullable=True)
    suggested_action: Mapped[str] = mapped_column(Text, nullable=True)
    is_dismissed: Mapped[bool] = mapped_column(Boolean, default=False)
    dismissed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    dismissed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    dismissed_reason: Mapped[str] = mapped_column(Text, nullable=True)

class AIChatSession(Base, IDMixin, TimestampMixin):
    __tablename__ = "ai_chat_sessions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    session_type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=True)
    messages: Mapped[list] = mapped_column(JSONB, default=[])
    context_data: Mapped[dict] = mapped_column(JSONB, nullable=True)
    model_used: Mapped[str] = mapped_column(String(100), default="claude-sonnet-4-20250514")
    tokens_used: Mapped[int] = mapped_column(Integer, default=0)

class AIAttritionScore(Base, IDMixin, TimestampMixin):
    __tablename__ = "ai_attrition_scores"

    employment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employments.id"), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id"), nullable=False)
    score_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    risk_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    risk_level: Mapped[str] = mapped_column(String(10), nullable=False)
    contributing_factors: Mapped[list] = mapped_column(JSONB, default=[])
    recommended_action: Mapped[str] = mapped_column(Text, nullable=True)
    is_actioned: Mapped[bool] = mapped_column(Boolean, default=False)
    actioned_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    actioned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
