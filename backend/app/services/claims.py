import uuid
import os
from datetime import datetime
from typing import List, Optional
from sqlalchemy import select, update, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import UploadFile

from app.models.claims import ClaimCategory, ClaimRequest, ClaimReceipt
from app.models.employment import Employment
from app.schemas.claims import ClaimCategoryCreate, ClaimCategoryUpdate, ClaimRequestCreate, ClaimRequestUpdate

class ClaimsService:
    @staticmethod
    async def create_category(db: AsyncSession, obj_in: ClaimCategoryCreate, tenant_id: uuid.UUID) -> ClaimCategory:
        db_obj = ClaimCategory(
            **obj_in.model_dump(),
            tenant_id=tenant_id
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj

    @staticmethod
    async def list_categories(db: AsyncSession, entity_id: uuid.UUID, tenant_id: uuid.UUID) -> List[ClaimCategory]:
        stmt = select(ClaimCategory).where(
            ClaimCategory.tenant_id == tenant_id,
            ClaimCategory.entity_id == entity_id,
            ClaimCategory.is_active == True
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def submit_claim(
        db: AsyncSession, 
        obj_in: ClaimRequestCreate, 
        employment_id: uuid.UUID, 
        tenant_id: uuid.UUID,
        receipts: List[UploadFile] = []
    ) -> ClaimRequest:
        db_obj = ClaimRequest(
            **obj_in.model_dump(),
            employment_id=employment_id,
            tenant_id=tenant_id,
            status="pending"
        )
        db.add(db_obj)
        await db.flush() # Get ID for receipts

        for receipt in receipts:
            # Simple local storage for now
            ext = os.path.splitext(receipt.filename)[1]
            filename = f"claim_{uuid.uuid4()}{ext}"
            upload_dir = os.path.join("uploads", "receipts")
            os.makedirs(upload_dir, exist_ok=True)
            file_path = os.path.join(upload_dir, filename)
            
            with open(file_path, "wb") as f:
                f.write(await receipt.read())
            
            db_receipt = ClaimReceipt(
                claim_id=db_obj.id,
                receipt_url=f"/uploads/receipts/{filename}",
                filename=receipt.filename
            )
            db.add(db_receipt)
        await db.commit()
        
        # Eagerly load relationships for response
        stmt = select(ClaimRequest).options(
            selectinload(ClaimRequest.receipts), 
            selectinload(ClaimRequest.category)
        ).where(ClaimRequest.id == db_obj.id)
        result = await db.execute(stmt)
        return result.scalar_one()

    @staticmethod
    async def list_claims(
        db: AsyncSession, 
        tenant_id: uuid.UUID,
        employment_id: Optional[uuid.UUID] = None,
        entity_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None
    ) -> List[ClaimRequest]:
        stmt = select(ClaimRequest).options(selectinload(ClaimRequest.receipts), selectinload(ClaimRequest.category)).where(ClaimRequest.tenant_id == tenant_id)
        
        if employment_id:
            stmt = stmt.where(ClaimRequest.employment_id == employment_id)
        if entity_id:
            stmt = stmt.join(Employment, ClaimRequest.employment_id == Employment.id).where(
                Employment.entity_id == entity_id
            )
        if status:
            stmt = stmt.where(ClaimRequest.status == status)
            
        stmt = stmt.order_by(ClaimRequest.claim_date.desc())
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def update_claim_status(
        db: AsyncSession,
        claim_id: uuid.UUID,
        status: str,
        user_id: uuid.UUID,
        rejection_reason: Optional[str] = None
    ) -> Optional[ClaimRequest]:
        stmt = select(ClaimRequest).where(ClaimRequest.id == claim_id)
        result = await db.execute(stmt)
        db_obj = result.scalar_one_or_none()
        
        if not db_obj:
            return None
            
        db_obj.status = status
        if status == "approved":
            db_obj.approved_by = user_id
            db_obj.approved_at = datetime.now()
        elif status == "rejected":
            db_obj.rejection_reason = rejection_reason
            
        await db.commit()
        
        # Eagerly load relationships for response
        stmt = select(ClaimRequest).options(
            selectinload(ClaimRequest.receipts), 
            selectinload(ClaimRequest.category)
        ).where(ClaimRequest.id == db_obj.id)
        result = await db.execute(stmt)
        return result.scalar_one()
