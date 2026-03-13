from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from app.models.system import AuditLog, SystemAuditLog
from app.schemas.audit import AuditLogCreate, SystemAuditLogCreate
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

def to_dict(model):
    """Helper to convert SQLAlchemy model to dict, excluding internal state."""
    if not model:
        return None
    result = {}
    for c in model.__table__.columns:
        value = getattr(model, c.name)
        if isinstance(value, UUID):
            value = str(value)
        elif isinstance(value, (date, datetime)):
            value = value.isoformat()
        elif isinstance(value, Decimal):
            value = float(value)
        result[c.name] = value
    return result

class AuditService:
    @staticmethod
    async def log_action(
        db: AsyncSession,
        action: str,
        table_name: str,
        record_id: Optional[UUID] = None,
        old_value: Optional[Dict[str, Any]] = None,
        new_value: Optional[Dict[str, Any]] = None,
        user_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        entity_id: Optional[UUID] = None,
        ip_address: Optional[str] = None,
        impersonated_by: Optional[UUID] = None
    ):
        """
        Logs a granular data change (INSERT, UPDATE, DELETE).
        """
        audit_entry = AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            entity_id=entity_id,
            table_name=table_name,
            record_id=record_id,
            action=action,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            impersonated_by=impersonated_by
        )
        db.add(audit_entry)
        # Note: We don't commit here; we rely on the caller's transaction
        return audit_entry

    @staticmethod
    async def log_system_event(
        db: AsyncSession,
        action: str,
        user_id: Optional[UUID] = None,
        tenant_id: Optional[UUID] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None
    ):
        """
        Logs a high-level system event (e.g., LOGIN, MFA_VERIFIED).
        """
        system_log = SystemAuditLog(
            admin_id=None, # For platform admins, we'd use a different flow or set this if applicable
            user_id=user_id,
            tenant_id=tenant_id,
            action=action,
            ip_address=ip_address,
            details=details
        )
        # Note: We use "admin_id" in the model for PlatformAdmins,
        # and "user_id" for standard tenant users.
        
        db.add(system_log)
        return system_log

    @staticmethod
    async def get_audit_logs(
        db: AsyncSession,
        tenant_id: UUID,
        entity_id: Optional[UUID] = None,
        user_id: Optional[UUID] = None,
        action: Optional[str] = None,
        table_name: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Dict[str, Any]:
        query = select(AuditLog).where(AuditLog.tenant_id == tenant_id)
        
        if entity_id:
            query = query.where(AuditLog.entity_id == entity_id)
        if user_id:
            query = query.where(AuditLog.user_id == user_id)
        if action:
            query = query.where(AuditLog.action == action)
        if table_name:
            query = query.where(AuditLog.table_name == table_name)
            
        count_query = select(func.count()).select_from(query.subquery())
        total = await db.scalar(count_query)
        
        query = query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit)
        result = await db.execute(query)
        
        return {
            "items": list(result.scalars().all()),
            "total": total or 0
        }

    @staticmethod
    async def get_system_logs(
        db: AsyncSession,
        tenant_id: UUID,
        action: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> Dict[str, Any]:
        query = select(SystemAuditLog).where(SystemAuditLog.tenant_id == tenant_id)
        
        if action:
            query = query.where(SystemAuditLog.action == action)
            
        count_query = select(func.count()).select_from(query.subquery())
        total = await db.scalar(count_query)
        
        query = query.order_by(desc(SystemAuditLog.created_at)).offset(skip).limit(limit)
        result = await db.execute(query)
        
        return {
            "items": list(result.scalars().all()),
            "total": total or 0
        }
