from sqlalchemy import Column, String, Boolean, DateTime, Text, ARRAY, Integer, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
import uuid
from .base import Base, IDMixin, TimestampMixin

class User(Base, IDMixin, TimestampMixin):
    __tablename__ = "users"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_tenant_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    two_fa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    two_fa_secret: Mapped[str] = mapped_column(String(255), nullable=True)
    last_login: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_ip: Mapped[str] = mapped_column(INET, nullable=True)
    password_reset_token: Mapped[str] = mapped_column(String(255), nullable=True)
    password_reset_expires: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    
    person_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("persons.id", ondelete="SET NULL"), nullable=True)

    entity_access: Mapped[list["UserEntityAccess"]] = relationship(foreign_keys="[UserEntityAccess.user_id]")

class Role(Base, IDMixin, TimestampMixin):
    __tablename__ = "roles"
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(String(200), nullable=True)

class RolePermission(Base):
    __tablename__ = "role_permissions"
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission: Mapped[str] = mapped_column(String(50), primary_key=True)

class UserEntityAccess(Base, IDMixin, TimestampMixin):
    __tablename__ = "user_entity_access"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("entities.id", ondelete="CASCADE"), nullable=False)
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    
    managed_department_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    managed_group_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=True)
    granted_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
