from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
import uuid
import os
import shutil
from typing import Any

from app.core.database import get_db
from app.api.v1.dependencies import get_current_user
from app.models.auth import User
from app.core.security.auth import verify_password, get_password_hash
from pydantic import BaseModel, constr

router = APIRouter(prefix="/profile", tags=["Profile"])

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: constr(min_length=8)

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload and update user profile picture.
    """
    # Validate file type
    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG and WebP images are allowed")

    # Create directory if not exists
    upload_dir = "uploads/avatars"
    os.makedirs(upload_dir, exist_ok=True)

    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    filename = f"{current_user.id}_{uuid.uuid4().hex}{file_extension}"
    file_path = os.path.join(upload_dir, filename)

    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Update user avatar_url
    # We'll store the relative path or a full URL if configured
    avatar_url = f"/uploads/avatars/{filename}"
    current_user.avatar_url = avatar_url
    
    await db.commit()
    await db.refresh(current_user)

    return {"avatar_url": avatar_url}

@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Securely change user password.
    """
    # Verify current password
    if not current_user.password_hash or not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    # Update password
    current_user.password_hash = get_password_hash(data.new_password)
    await db.commit()

    return {"message": "Password updated successfully"}
