from sqlalchemy.ext.asyncio import AsyncSession
import uuid
from app.models.leave import LeaveType

async def seed_default_leave_types_and_rules(db: AsyncSession, entity_id: uuid.UUID):
    """
    Seeds the standard Singapore MOM statutory leave types for a newly created Entity.
    The StatutoryLeaveRule table holds the progression ladders globally by leave_type_code,
    so we only need to create the Entity-specific LeaveType records.
    """
    leave_types = [
        LeaveType(entity_id=entity_id, name="Annual Leave", code="AL", is_paid=True, is_statutory=True),
        LeaveType(entity_id=entity_id, name="Medical (Outpatient)", code="ML", is_paid=True, is_statutory=True),
        LeaveType(entity_id=entity_id, name="Hospitalisation", code="HL", is_paid=True, is_statutory=True),
        LeaveType(entity_id=entity_id, name="Childcare Leave", code="CL", is_paid=True, is_statutory=True),
        LeaveType(entity_id=entity_id, name="Extended Childcare", code="ECL", is_paid=True, is_statutory=True),
        LeaveType(entity_id=entity_id, name="Maternity (GPML)", code="MAT", is_paid=True, is_statutory=True),
        LeaveType(entity_id=entity_id, name="Paternity (GPPL)", code="PAT", is_paid=True, is_statutory=True),
        LeaveType(entity_id=entity_id, name="Shared Parental", code="SPL", is_paid=True, is_statutory=True),
        LeaveType(entity_id=entity_id, name="Unpaid Infant Care", code="UPL", is_paid=False, is_statutory=True)
    ]
    
    db.add_all(leave_types)
    # The caller will commit the session
