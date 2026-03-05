from datetime import datetime
from typing import Any
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import DateTime, JSON, String, UUID, func
import uuid

class Base(DeclarativeBase):
    pass

class AuditMixin:
    """
    Mixin for tracking creation and updates.
    Includes support for soft-deletes and JSONB diffs in the audit log.
    """
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Common across all tenant tables
    @declared_attr
    def tenant_id(cls) -> Mapped[uuid.UUID]:
        return mapped_column(UUID(as_uuid=True), index=True, nullable=True)

class IDMixin:
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
