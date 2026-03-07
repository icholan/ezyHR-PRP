from sqlalchemy import Column, String, Boolean, DateTime, Text, ARRAY, Integer, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid
from .base import Base, AuditMixin, IDMixin, TimestampMixin

class PlatformAdmin(Base, IDMixin, TimestampMixin):
    __tablename__ = "platform_admins"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="admin")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    mfa_secret: Mapped[str] = mapped_column(String(255), nullable=True)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_backup_codes: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=True)
    last_login_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_ip: Mapped[str] = mapped_column(INET, nullable=True)
    password_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("platform_admins.id"), nullable=True)

class Tenant(Base, IDMixin, TimestampMixin):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    subscription_plan: Mapped[str] = mapped_column(String(50), default="starter")
    billing_email: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_number: Mapped[str] = mapped_column(String(20), nullable=True)
    setup_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    suspended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    suspended_reason: Mapped[str] = mapped_column(Text, nullable=True)
    suspended_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("platform_admins.id"), nullable=True)
    trial_ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    mrr: Mapped[float] = mapped_column(Numeric(10, 2), nullable=True)
    assigned_csm: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("platform_admins.id"), nullable=True)
    stripe_customer_id: Mapped[str] = mapped_column(String(100), nullable=True)
    data_deletion_requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    data_deletion_completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)

    entities = relationship("Entity", back_populates="tenant")

class Entity(Base, IDMixin, TimestampMixin):
    __tablename__ = "entities"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    uen: Mapped[str] = mapped_column(String(50), unique=True, nullable=True)
    cpf_account_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=True)
    iras_tax_ref: Mapped[str] = mapped_column(String(50), unique=True, nullable=True)
    registered_address: Mapped[str] = mapped_column(Text, nullable=True)
    gst_registered: Mapped[bool] = mapped_column(Boolean, default=False)
    gst_no: Mapped[str] = mapped_column(String(50), nullable=True)
    industry_code: Mapped[str] = mapped_column(String(50), nullable=True)
    payroll_cutoff_day: Mapped[int] = mapped_column(Integer, default=25)
    payment_day: Mapped[int] = mapped_column(Integer, default=28)
    work_week_hours: Mapped[float] = mapped_column(Numeric(4, 2), default=44.0)
    attendance_roster_mode: Mapped[str] = mapped_column(String(20), default="manual") # manual | smart_match
    website: Mapped[str] = mapped_column(String(255), nullable=True)
    
    # Banking Details (GIRO/Payroll)
    bank_name: Mapped[str] = mapped_column(String(100), nullable=True)
    bank_account_no: Mapped[str] = mapped_column(String(100), nullable=True)
    bank_account_name: Mapped[str] = mapped_column(String(255), nullable=True)
    bank_branch_code: Mapped[str] = mapped_column(String(20), nullable=True)
    bank_swift_code: Mapped[str] = mapped_column(String(20), nullable=True)
    
    logo_url: Mapped[str] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tenant = relationship("Tenant", back_populates="entities")
