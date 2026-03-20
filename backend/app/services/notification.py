from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_
from app.models.system import Notification
from app.models.employment import PersonDocument, Person, Employment
from app.models.auth import User
from app.schemas.notification import NotificationCreate, NotificationUpdate
from datetime import date, timedelta, datetime
import uuid

class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_notification(self, data: NotificationCreate) -> Notification:
        db_notification = Notification(**data.model_dump())
        self.db.add(db_notification)
        await self.db.commit()
        await self.db.refresh(db_notification)
        return db_notification

    async def list_notifications(self, user_id: uuid.UUID, only_unread: bool = False) -> List[Notification]:
        query = select(Notification).where(Notification.user_id == user_id).order_by(Notification.sent_at.desc())
        if only_unread:
            query = query.where(Notification.is_read == False)
        
        result = await self.db.execute(query)
        return result.scalars().all()

    async def mark_as_read(self, notification_id: uuid.UUID, user_id: uuid.UUID):
        query = update(Notification).where(
            and_(Notification.id == notification_id, Notification.user_id == user_id)
        ).values(is_read=True)
        await self.db.execute(query)
        await self.db.commit()

    async def mark_all_as_read(self, user_id: uuid.UUID):
        query = update(Notification).where(
            and_(Notification.user_id == user_id, Notification.is_read == False)
        ).values(is_read=True)
        await self.db.execute(query)
        await self.db.commit()

    async def check_and_notify_document_expiry(self, tenant_id: uuid.UUID):
        """
        Checks for all non-expired documents in a tenant that are expiring within 30 days.
        Creates notifications for the associated users if they don't already have an unread notification for that document.
        """
        expiry_threshold = date.today() + timedelta(days=30)
        
        # Find expiring documents
        query = (
            select(PersonDocument, Person)
            .join(Person, PersonDocument.person_id == Person.id)
            .where(
                and_(
                    Person.tenant_id == tenant_id,
                    PersonDocument.is_active == True,
                    PersonDocument.expiry_date <= expiry_threshold,
                    PersonDocument.expiry_date >= date.today()
                )
            )
        )
        
        result = await self.db.execute(query)
        expiring = result.all()

        # Find all Tenant Admins
        admin_query = select(User).where(
            and_(User.tenant_id == tenant_id, User.is_tenant_admin == True, User.is_active == True)
        )
        admin_result = await self.db.execute(admin_query)
        admins = admin_result.scalars().all()
        
        for doc, person in expiring:
            # 1. Notify the Employee (if they have a user account)
            user_query = select(User).where(User.person_id == person.id)
            user_res = await self.db.execute(user_query)
            user = user_res.scalar_one_or_none()
            
            if user:
                title = f"Document Expiring: {doc.document_type}"
                message = f"Your {doc.document_type} (No: {doc.document_number}) is expiring on {doc.expiry_date}."
                await self._ensure_notification(user.id, "DOCUMENT_EXPIRY", title, message)

            # 2. Notify all Tenant Admins
            for admin in admins:
                title = f"Expiring Document: {person.full_name}"
                message = f"{person.full_name}'s {doc.document_type} (No: {doc.document_number}) is expiring on {doc.expiry_date}."
                await self._ensure_notification(admin.id, "DOCUMENT_EXPIRY_ADMIN", title, message)
        
        await self.db.commit()

    async def _ensure_notification(self, user_id: uuid.UUID, type: str, title: str, message: str):
        """Helper to create a notification only if an unread one doesn't exist."""
        existing_query = select(Notification).where(
            and_(
                Notification.user_id == user_id,
                Notification.type == type,
                Notification.title == title,
                Notification.is_read == False
            )
        )
        existing_res = await self.db.execute(existing_query)
        if not existing_res.scalars().first():
            new_notif = Notification(
                user_id=user_id,
                type=type,
                title=title,
                message=message,
                sent_at=datetime.utcnow()
            )
            self.db.add(new_notif)
