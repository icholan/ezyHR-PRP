from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid
from app.core.database import get_db
from app.api.v1.dependencies import get_current_user
from app.models.auth import User
from app.schemas.notification import NotificationRead, NotificationUpdate
from app.services.notification import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("/", response_model=List[NotificationRead])
async def list_notifications(
    only_unread: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NotificationService(db)
    return await service.list_notifications(current_user.id, only_unread=only_unread)

@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NotificationService(db)
    await service.mark_as_read(notification_id, current_user.id)
    return {"status": "success"}

@router.put("/read-all")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NotificationService(db)
    await service.mark_all_as_read(current_user.id)
    return {"status": "success"}

@router.post("/sync-expiry")
async def sync_expiry_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Manual trigger to sync document expiry notifications for testing."""
    if not current_user.is_tenant_admin:
        raise HTTPException(status_code=403, detail="Only admins can trigger a global sync.")
    
    service = NotificationService(db)
    await service.check_and_notify_document_expiry(current_user.tenant_id)
    return {"status": "sync_completed"}
