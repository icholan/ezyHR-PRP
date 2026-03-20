from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
import uuid

class NotificationBase(BaseModel):
    user_id: uuid.UUID
    type: str
    title: str
    message: Optional[str] = None
    is_read: bool = False

class NotificationCreate(NotificationBase):
    pass

class NotificationUpdate(BaseModel):
    is_read: bool

class NotificationRead(NotificationBase):
    id: uuid.UUID
    sent_at: datetime

    model_config = ConfigDict(from_attributes=True)
