"""
Leave Engine — Phase 1 (DB-Driven Rules)
=========================================
All statutory limits are now resolved from the database:
  - statutory_leave_rules  → MOM EA step-tables (AL, SICK, HOSP, PATERNITY …)
  - leave_pools            → Shared caps between leave types (SICK_POOL, SPL_POOL)
  - leave_type_policies    → Per-entity company overrides (e.g. 18 days AL)

Engine resolution order (per apply_leave & get_balances):
  1. Company override  (leave_type_policies)
  2. MOM statutory rule (statutory_leave_rules, date-effective)
  3. Carry forward     (carried_over_days in leave_entitlements)
  4. Pool sub-cap      (leave_types.pool_sub_cap)
  5. Pool cap          (leave_pools.cap_days, scope: employment | family)
  6. Overall balance   (total - used - pending)
"""
from typing import Optional, List
from datetime import date, datetime, timedelta
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from app.models.leave import (
    LeaveRequest, LeaveEntitlement, LeaveType,
    LeavePool, StatutoryLeaveRule, LeaveTypePolicy, LeaveCarryPolicy
)
from app.models.employment import Employment, Person
from app.schemas.leave import LeaveRequestCreate
from app.services.attendance import AttendanceService


class LeaveService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ─────────────────────────────────────────────
    # Tenure Helpers
    # ─────────────────────────────────────────────

    def get_tenure_months(self, join_date: date, current_date: date) -> int:
        """Calculates completed months of service (anniversary-based)."""
        diff = (current_date.year - join_date.year) * 12 + (current_date.month - join_date.month)
        if current_date.day < join_date.day:
            diff -= 1
        return max(0, diff)

    def resolve_progression(self, progression: list, tenure: int) -> float:
        """
        Finds the highest step where min_tenure <= tenure.
        Works for both 'months' (SICK/HOSP) and 'years' (ANNUAL) since
        the caller already converts to the right unit.
        """
        applicable = [row for row in progression if row["min_tenure"] <= tenure]
        if not applicable:
            return 0.0
        return float(max(applicable, key=lambda r: r["min_tenure"])["days"])

    # ─────────────────────────────────────────────
    # DB-Driven: Statutory Rule Lookup
    # ─────────────────────────────────────────────

    async def get_statutory_rule(self, leave_type_code: str, as_of_date: date) -> Optional[StatutoryLeaveRule]:
        """
        Returns the MOM statutory rule active on as_of_date.
        Picks MAX(effective_from) WHERE effective_from <= as_of_date
        (and effective_to IS NULL or >= as_of_date).
        Falls back to None if no rule defined (engine will skip statutory check).
        """
        stmt = select(StatutoryLeaveRule).where(
            and_(
                StatutoryLeaveRule.leave_type_code == leave_type_code,
                StatutoryLeaveRule.effective_from <= as_of_date,
                or_(
                    StatutoryLeaveRule.effective_to == None,
                    StatutoryLeaveRule.effective_to >= as_of_date
                )
            )
        ).order_by(StatutoryLeaveRule.effective_from.desc()).limit(1)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_statutory_limit(
        self,
        leave_type_code: str,
        join_date: date,
        as_of_date: date,
        event_date: date = None
    ) -> float:
        """
        Resolves the statutory entitlement days for a given leave code,
        based on tenure and the MOM step table active on as_of_date OR event_date.
        event_date is used for birth-date dependent rules (GPPL/Paternity).
        """
        lookup_date = event_date or as_of_date
        rule = await self.get_statutory_rule(leave_type_code, lookup_date)
        if not rule:
            return 0.0
        tenure_months = self.get_tenure_months(join_date, lookup_date)
        tenure = tenure_months // 12 if rule.tenure_unit == "years" else tenure_months
        return self.resolve_progression(rule.progression, tenure)

    # ─────────────────────────────────────────────
    # DB-Driven: Company Override Lookup
    # ─────────────────────────────────────────────

    async def get_company_override(
        self,
        entity_id: uuid.UUID,
        leave_type_code: str,
        as_of_date: date
    ) -> Optional[float]:
        """
        Returns company-specific leave cap override if configured.
        Takes precedence over statutory limit.
        """
        stmt = select(LeaveTypePolicy).where(
            and_(
                LeaveTypePolicy.entity_id == entity_id,
                LeaveTypePolicy.leave_type_code == leave_type_code,
                LeaveTypePolicy.effective_from <= as_of_date,
                or_(
                    LeaveTypePolicy.effective_to == None,
                    LeaveTypePolicy.effective_to >= as_of_date
                )
            )
        ).order_by(LeaveTypePolicy.effective_from.desc()).limit(1)
        res = await self.db.execute(stmt)
        policy = res.scalar_one_or_none()
        return float(policy.override_days) if policy and policy.override_days else None

    # ─────────────────────────────────────────────
    # Phase 2B: Carry-Forward Logic
    # ─────────────────────────────────────────────

    async def get_carry_policy(
        self,
        entity_id: uuid.UUID,
        leave_type_code: str,
        as_of_date: date
    ) -> Optional[LeaveCarryPolicy]:
        """Returns the carry-forward policy active on as_of_date."""
        stmt = select(LeaveCarryPolicy).where(
            and_(
                LeaveCarryPolicy.entity_id == entity_id,
                LeaveCarryPolicy.leave_type_code == leave_type_code,
                LeaveCarryPolicy.effective_from <= as_of_date,
                or_(
                    LeaveCarryPolicy.effective_to == None,
                    LeaveCarryPolicy.effective_to >= as_of_date
                )
            )
        ).order_by(LeaveCarryPolicy.effective_from.desc()).limit(1)
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def calculate_carry_forward(
        self,
        employment_id: uuid.UUID,
        leave_type_id: uuid.UUID,
        leave_type_code: str,
        entity_id: uuid.UUID,
        prev_year: int
    ) -> float:
        """
        Calculates how many days can be carried forward from prev_year.
        Checks for unused balance and applies company policy limits.
        """
        # 1. Fetch previous year entitlement
        stmt = select(LeaveEntitlement).where(
            and_(
                LeaveEntitlement.employment_id == employment_id,
                LeaveEntitlement.leave_type_id == leave_type_id,
                LeaveEntitlement.year == prev_year
            )
        )
        res = await self.db.execute(stmt)
        ent = res.scalar_one_or_none()
        if not ent:
            return 0.0

        # Unused = Total - Used - Pending
        unused = float(ent.total_days) - float(ent.used_days) - float(ent.pending_days)
        if unused <= 0:
            return 0.0

        # 2. Fetch policy
        # We look for the policy active at the end of the previous year
        policy = await self.get_carry_policy(entity_id, leave_type_code, date(prev_year, 12, 31))
        if not policy:
            return 0.0 # No policy = no carry-forward by default

        # 3. Apply limits
        return float(min(unused, float(policy.max_carry_days)))

    # ─────────────────────────────────────────────
    # DB-Driven: Resolve Total Entitlement
    # ─────────────────────────────────────────────

    async def resolve_entitlement(
        self,
        entity_id: uuid.UUID,
        leave_type_code: str,
        join_date: date,
        as_of_date: date,
        carried_over_days: float = 0.0,
        event_date: date = None
    ) -> float:
        """
        Full entitlement resolution:
          1. Company override (if any)     → use as flat cap
          2. MOM statutory step-table      → resolve by tenure (optionally by event_date)
          3. Add carry-forward days
        Returns total allowed days for the year.
        """
        # Step 1: Company override
        override = await self.get_company_override(entity_id, leave_type_code, as_of_date)
        if override is not None:
            return override + carried_over_days

        # Step 2: MOM statutory rule
        statutory = await self.get_statutory_limit(leave_type_code, join_date, as_of_date, event_date=event_date)

        # Step 3: Add carry forward
        return statutory + carried_over_days

    # ─────────────────────────────────────────────
    # DB-Driven: Pool Checks
    # ─────────────────────────────────────────────

    async def check_pool_limits(
        self,
        leave_type: LeaveType,
        employment_id: uuid.UUID,
        days_requested: float,
        year: int
    ) -> None:
        """
        Checks both sub-cap and pool cap for a leave type.
        Raises ValueError if either cap is exceeded.
        Supports both 'employment' and 'family' scopes.
        """
        if not leave_type.pool_id:
            return  # No pool attached — no pool check needed

        # Fetch pool definition
        pool_stmt = select(LeavePool).where(LeavePool.id == leave_type.pool_id)
        pool_res = await self.db.execute(pool_stmt)
        pool = pool_res.scalar_one_or_none()
        if not pool:
            return

        # ── Sub-cap check (e.g. 14-day SICK outpatient sub-cap) ──
        if leave_type.pool_sub_cap is not None:
            sub_used_stmt = select(func.sum(LeaveRequest.days_count)).join(LeaveType).where(
                and_(
                    LeaveRequest.employment_id == employment_id,
                    LeaveType.pool_id == leave_type.pool_id,
                    LeaveType.pool_sub_cap != None,           # only types WITH a sub-cap
                    LeaveRequest.status.in_(["approved", "pending"]),
                    LeaveRequest.start_date >= date(year, 1, 1),
                    LeaveRequest.start_date <= date(year, 12, 31)
                )
            )
            sub_res = await self.db.execute(sub_used_stmt)
            sub_used = float(sub_res.scalar() or 0.0)
            if sub_used + days_requested > float(leave_type.pool_sub_cap):
                remaining = max(0.0, float(leave_type.pool_sub_cap) - sub_used)
                raise ValueError(
                    f"{leave_type.name} sub-cap of {leave_type.pool_sub_cap:.0f} days exceeded. "
                    f"Used: {sub_used:.1f}, Available: {remaining:.1f} days."
                )

        # ── Pool cap check (total across all types in pool) ──
        # For 'employment' scope: sum for this employment
        # For 'family' scope:    sum across all family members (Phase 3)
        if pool.scope == "family":
            # 1. Fetch person to get family_id
            person_stmt = select(Person.family_id).join(Employment).where(Employment.id == employment_id)
            person_res = await self.db.execute(person_stmt)
            family_id = person_res.scalar()
            
            if not family_id:
                # Fallback to employment scope if no family linked
                employment_ids = [employment_id]
            else:
                # Sum across all persons sharing same family_id
                emp_stmt = select(Employment.id).join(Person).where(Person.family_id == family_id)
                emp_res = await self.db.execute(emp_stmt)
                employment_ids = emp_res.scalars().all()
        else:
            employment_ids = [employment_id]

        pool_used_stmt = select(func.sum(LeaveRequest.days_count)).join(LeaveType).where(
            and_(
                LeaveRequest.employment_id.in_(employment_ids),
                LeaveType.pool_id == leave_type.pool_id,
                LeaveRequest.status.in_(["approved", "pending"]),
                LeaveRequest.start_date >= date(year, 1, 1),
                LeaveRequest.start_date <= date(year, 12, 31)
            )
        )
        pool_used_res = await self.db.execute(pool_used_stmt)
        pool_used = float(pool_used_res.scalar() or 0.0)

        if pool_used + days_requested > float(pool.cap_days):
            remaining = max(0.0, float(pool.cap_days) - pool_used)
            scope_desc = "family" if pool.scope == "family" and len(employment_ids) > 1 else "employment"
            raise ValueError(
                f"{pool.name} pool cap of {pool.cap_days:.0f} days exceeded for this {scope_desc}. "
                f"Used: {pool_used:.1f}, Available: {remaining:.1f} days."
            )

    # ─────────────────────────────────────────────
    # Working Day Calculation (PH + Rest Day Aware)
    # ─────────────────────────────────────────────

    async def count_working_days(
        self,
        entity_id: uuid.UUID,
        start_date: date,
        end_date: date,
        rest_day: Optional[str]
    ) -> float:
        """Counts working days between start_date and end_date, excluding PH and rest day."""
        attendance_service = AttendanceService(self.db)
        ph_dates = await attendance_service.get_ph_dates_set(entity_id, start_date, end_date)

        days = 0.0
        current = start_date
        while current <= end_date:
            if current in ph_dates:
                current += timedelta(days=1)
                continue
            if rest_day and current.strftime("%A").lower() == rest_day.lower():
                current += timedelta(days=1)
                continue
            if not rest_day and current.strftime("%A").lower() == "sunday":
                current += timedelta(days=1)
                continue
            days += 1.0
            current += timedelta(days=1)
        return days

    # ─────────────────────────────────────────────
    # Cross-Entity Overlap Check
    # ─────────────────────────────────────────────

    async def check_overlap(self, person_id: uuid.UUID, start_date: date, end_date: date) -> List[dict]:
        """Checks if the person has overlapping leave across ALL their employments."""
        emp_stmt = select(Employment).where(Employment.person_id == person_id)
        emp_result = await self.db.execute(emp_stmt)
        emp_ids = [e.id for e in emp_result.scalars().all()]

        overlap_stmt = select(LeaveRequest, LeaveType.name).join(LeaveType).where(
            and_(
                LeaveRequest.employment_id.in_(emp_ids),
                LeaveRequest.status.in_(["pending", "approved"]),
                or_(
                    and_(LeaveRequest.start_date <= start_date, LeaveRequest.end_date >= start_date),
                    and_(LeaveRequest.start_date <= end_date, LeaveRequest.end_date >= end_date),
                    and_(LeaveRequest.start_date >= start_date, LeaveRequest.end_date <= end_date)
                )
            )
        )
        result = await self.db.execute(overlap_stmt)
        conflicts = []
        for row in result.all():
            req, leave_name = row
            conflicts.append({
                "employment_id": req.employment_id,
                "start_date": req.start_date,
                "end_date": req.end_date,
                "status": req.status,
                "leave_type": leave_name
            })
        return conflicts

    # ─────────────────────────────────────────────
    # Main: Apply Leave — Full Engine Resolution
    # ─────────────────────────────────────────────

    async def check_lifetime_cap(
        self,
        employment_id: uuid.UUID,
        leave_type_code: str,
        days_requested: float,
        lifetime_cap: float = 42.0
    ) -> None:
        """
        Enforce a lifetime cap across all years (e.g., 42 days for CHILDCARE).
        """
        # Sum all approved/pending requests across ALL history for this person/employment
        stmt = select(func.sum(LeaveRequest.days_count)).join(LeaveType).where(
            and_(
                LeaveRequest.employment_id == employment_id,
                LeaveType.code == leave_type_code,
                LeaveRequest.status.in_(["approved", "pending"])
            )
        )
        res = await self.db.execute(stmt)
        used_to_date = float(res.scalar() or 0.0)
        
        if used_to_date + days_requested > lifetime_cap:
            remaining = max(0.0, lifetime_cap - used_to_date)
            raise ValueError(
                f"Lifetime cap of {lifetime_cap:.0f} days for {leave_type_code} exceeded. "
                f"Used to date: {used_to_date:.1f}, Remaining: {remaining:.1f} days."
            )

    async def apply_leave(self, req_data: LeaveRequestCreate):
        """
        Processes a leave application with full DB-driven entitlement validation.

        Phase 1-3 Engine Resolution Order:
          1. Overlap check
          2. Count working days
          3. Fetch leave type & employment
          4. Tenure barrier check (3 months)
          5. Lifetime cap check (Phase 3: Childcare)
          6. Fetch/Resolve entitlement (with birth-date support)
          7. Pool sub-cap + pool cap check (inc. family scope Phase 3)
          8. Overall balance check
          9. Create LeaveRequest (status=pending)
        """
        # ── 1. Fetch Employment & Overlap check ──
        emp_stmt = select(Employment).where(Employment.id == req_data.employment_id)
        emp_res = await self.db.execute(emp_stmt)
        emp = emp_res.scalar_one()

        conflicts = await self.check_overlap(emp.person_id, req_data.start_date, req_data.end_date)
        if conflicts:
            same_emp_conflicts = [c for c in conflicts if c["employment_id"] == req_data.employment_id]
            if same_emp_conflicts:
                raise ValueError("You already have a leave request covering these dates.")

        # ── 2. Count working days ──
        days = await self.count_working_days(
            emp.entity_id, req_data.start_date, req_data.end_date, emp.rest_day
        )
        if days == 0:
            raise ValueError("The selected date range consists only of holidays or rest days.")

        # ── 3. Fetch Leave Type ──
        type_stmt = select(LeaveType).where(LeaveType.id == req_data.leave_type_id)
        type_res = await self.db.execute(type_stmt)
        l_type = type_res.scalar_one()

        year = req_data.start_date.year
        tenure_months = self.get_tenure_months(emp.join_date, req_data.start_date)

        # ── 4. Tenure barrier check ──
        if l_type.is_statutory and l_type.is_paid and tenure_months < 3:
            raise ValueError(f"Statutory paid {l_type.name} is only available after 3 months of service.")

        # ── 5. Lifetime Cap Check (Phase 3: Childcare 42-day cap) ──
        if l_type.code == "CHILDCARE":
            await self.check_lifetime_cap(req_data.employment_id, l_type.code, days, lifetime_cap=42.0)

        # ── 6. Fetch existing entitlement record (for carry-forward days) ──
        ent_stmt = select(LeaveEntitlement).where(
            and_(
                LeaveEntitlement.employment_id == req_data.employment_id,
                LeaveEntitlement.leave_type_id == req_data.leave_type_id,
                LeaveEntitlement.year == year
            )
        )
        ent_res = await self.db.execute(ent_stmt)
        entitlement = ent_res.scalar_one_or_none()
        carried = float(entitlement.carried_over_days) if entitlement else 0.0

        # ── 7. Resolve effective limit (Phase 3: birth-based resolution) ──
        limit = await self.resolve_entitlement(
            emp.entity_id, 
            l_type.code, 
            emp.join_date, 
            req_data.start_date, 
            carried_over_days=carried,
            event_date=req_data.child_birth_date
        )

        if limit == 0.0 and l_type.is_statutory:
             raise ValueError(f"No statutory rule configured for leave type '{l_type.code}'.")

        # ── 8. Pool Checks (Sub-caps & Phase 3 Family Pools) ──
        await self.check_pool_limits(l_type, req_data.employment_id, days, year)

        # ── 9. Overall balance check ──
        if entitlement:
            used = float(entitlement.used_days)
            pending = float(entitlement.pending_days)
        else:
            used_stmt = select(func.sum(LeaveRequest.days_count)).where(
                and_(
                    LeaveRequest.employment_id == req_data.employment_id,
                    LeaveRequest.leave_type_id == l_type.id,
                    LeaveRequest.status.in_(["approved", "pending"]),
                    LeaveRequest.start_date >= date(year, 1, 1),
                    LeaveRequest.start_date <= date(year, 12, 31)
                )
            )
            used_res = await self.db.execute(used_stmt)
            used = float(used_res.scalar() or 0.0)
            pending = 0.0

        available = limit - used - pending
        if days > available:
            raise ValueError(
                f"Insufficient balance for {l_type.name}. "
                f"Available: {available:.1f} days (Entitlement: {limit:.1f})."
            )

        # ── 10. Finalise: Create Leave Request ──
        new_req = LeaveRequest(
            employment_id=req_data.employment_id,
            leave_type_id=req_data.leave_type_id,
            start_date=req_data.start_date,
            end_date=req_data.end_date,
            days_count=days,
            reason=req_data.reason,
            attachment_url=req_data.attachment_url,
            child_birth_date=req_data.child_birth_date, # Phase 3 Support
            child_order=req_data.child_order,           # Phase 4 Support
            status="pending"
        )
        self.db.add(new_req)

        # Update pending balance if static entitlement exists
        if entitlement:
            entitlement.pending_days = float(entitlement.pending_days) + days

        await self.db.flush()
        return new_req, conflicts

    async def grant_initial_entitlements(self, employment_id: uuid.UUID) -> List[LeaveEntitlement]:
        """
        Calculates and saves initial leave entitlements for a new employee.
        Called during onboarding.
        """
        # 1. Fetch Employment
        emp_stmt = select(Employment).where(Employment.id == employment_id)
        emp_res = await self.db.execute(emp_stmt)
        emp = emp_res.scalar_one_or_none()
        if not emp:
            raise ValueError("Employment record not found.")

        # 2. Fetch all active Leave Types for the entity
        types_stmt = select(LeaveType).where(
            and_(LeaveType.entity_id == emp.entity_id, LeaveType.is_active == True)
        )
        types_res = await self.db.execute(types_stmt)
        leave_types = types_res.scalars().all()

        year = emp.join_date.year
        entitlements = []

        for lt in leave_types:
            # 3. Resolve entitlement base (Dynamic DB lookup)
            # Use year-end for statutory check as MOM rules resolve based on completion of year
            check_date = date(year, 12, 31)
            total_days = await self.resolve_entitlement(
                emp.entity_id, lt.code, emp.join_date, check_date, 0.0
            )

            # 4. Create Entitlement record
            entitlement = LeaveEntitlement(
                employment_id=employment_id,
                leave_type_id=lt.id,
                year=year,
                total_days=total_days,
                used_days=0.0,
                pending_days=0.0,
                carried_over_days=0.0
            )
            self.db.add(entitlement)
            entitlements.append(entitlement)

        return entitlements

    async def grant_new_year_entitlements(self, target_year: int) -> dict:
        """
        Runs annually (Jan 1) or on-demand.
        Iterates all active employees and creates new year entitlements with carry-forward.
        """
        # 1. Fetch all active Employments
        emp_stmt = select(Employment).where(Employment.is_active == True)
        emp_res = await self.db.execute(emp_stmt)
        employments = emp_res.scalars().all()

        results = {"total_processed": 0, "created": 0, "skipped": 0, "errors": 0}

        for emp in employments:
            try:
                # 2. Get active leave types for this entity
                lt_stmt = select(LeaveType).where(
                    and_(LeaveType.entity_id == emp.entity_id, LeaveType.is_active == True)
                )
                lt_res = await self.db.execute(lt_stmt)
                leave_types = lt_res.scalars().all()

                for lt in leave_types:
                    # 3. Check if already exists (Idempotency)
                    exist_stmt = select(LeaveEntitlement).where(
                        and_(
                            LeaveEntitlement.employment_id == emp.id,
                            LeaveEntitlement.leave_type_id == lt.id,
                            LeaveEntitlement.year == target_year
                        )
                    )
                    exist_res = await self.db.execute(exist_stmt)
                    if exist_res.scalar_one_or_none():
                        results["skipped"] += 1
                        continue

                    results["total_processed"] += 1
                    
                    # 4. Calculate Carry-Forward from prev year
                    carried_over = await self.calculate_carry_forward(
                        emp.id, lt.id, lt.code, emp.entity_id, target_year - 1
                    )

                    # 5. Resolve new year base entitlement
                    # Use Dec 31 of target_year to calculate base based on tenure reached by then
                    check_date = date(target_year, 12, 31)
                    total_days = await self.resolve_entitlement(
                        emp.entity_id, lt.code, emp.join_date, check_date, 0.0
                    )

                    # 6. Create record
                    new_ent = LeaveEntitlement(
                        employment_id=emp.id,
                        leave_type_id=lt.id,
                        year=target_year,
                        total_days=total_days,
                        carried_over_days=carried_over,
                        used_days=0.0,
                        pending_days=0.0
                    )
                    self.db.add(new_ent)
                    results["created"] += 1

                # Flush per employee to handle large batches better
                await self.db.flush()

            except Exception as e:
                print(f"❌ Error granting leave for Employment {emp.id}: {str(e)}")
                results["errors"] += 1

    async def expire_carried_leave(self, as_of_date: date) -> dict:
        """
        Processes expiry of carried-forward leave.
        Runs daily/monthly to zero out carried_over_days after their expiry date.
        """
        # 1. Fetch all active carry policies with expiry defined
        stmt = select(LeaveCarryPolicy).where(
            and_(
                LeaveCarryPolicy.carry_expiry_months != None,
                LeaveCarryPolicy.effective_from <= as_of_date,
                or_(
                    LeaveCarryPolicy.effective_to == None,
                    LeaveCarryPolicy.effective_to >= as_of_date
                )
            )
        )
        res = await self.db.execute(stmt)
        policies = res.scalars().all()

        results = {"policies_checked": len(policies), "entitlements_expired": 0, "errors": 0}

        for policy in policies:
            try:
                # 2. Compute expiry date: policy applies to previous year carry
                # If we are in 2026, we are looking at carry from 2025.
                # Expiry is typically X months after Jan 1 of the current year.
                year = as_of_date.year
                
                # Expiry check: 
                # e.g., carry_expiry_months = 3 (Mar 31)
                # We expire on April 1.
                # Logic: Jan 1 + carry_expiry_months months
                if as_of_date.month <= policy.carry_expiry_months:
                    # Not yet expired
                    continue
                
                # 3. Find entitlements for this entity/leave_type with carry > 0
                lt_stmt = select(LeaveType.id).where(
                    and_(
                        LeaveType.entity_id == policy.entity_id,
                        LeaveType.code == policy.leave_type_code
                    )
                )
                lt_res = await self.db.execute(lt_stmt)
                lt_ids = lt_res.scalars().all()
                
                if not lt_ids:
                    continue

                ent_stmt = select(LeaveEntitlement).where(
                    and_(
                        LeaveEntitlement.leave_type_id.in_(lt_ids),
                        LeaveEntitlement.year == year,
                        LeaveEntitlement.carried_over_days > 0
                    )
                )
                ent_res = await self.db.execute(ent_stmt)
                entitlements = ent_res.scalars().all()

                for ent in entitlements:
                    # 4. Zero out carry
                    # We log the expiry here if we had an audit table, 
                    # for now we just update the record.
                    ent.carried_over_days = 0.0
                    results["entitlements_expired"] += 1

                await self.db.flush()

            except Exception as e:
                print(f"❌ Error expiring leave for policy {policy.id}: {str(e)}")
                results["errors"] += 1

        await self.db.commit()
        return results

    # ─────────────────────────────────────────────
    # Get Balances — DB-Driven (All Leave Types)
    # ─────────────────────────────────────────────

    async def get_balances(self, employment_id: uuid.UUID, year: int):
        """
        Returns all leave balances for an employee.
        Statutory limits resolved from DB; company overrides honoured.
        Pool-shared types (SICK/HOSP) show pool-aware availability.
        """
        # Fetch Employment
        emp_stmt = select(Employment).where(Employment.id == employment_id)
        emp_res = await self.db.execute(emp_stmt)
        emp = emp_res.scalar_one()

        # Fetch active Leave Types for entity
        types_stmt = select(LeaveType).where(
            and_(LeaveType.entity_id == emp.entity_id, LeaveType.is_active == True)
        )
        types_res = await self.db.execute(types_stmt)
        leave_types = types_res.scalars().all()

        # Fetch usage by type + status
        usage_stmt = select(
            LeaveRequest.leave_type_id,
            LeaveRequest.status,
            func.sum(LeaveRequest.days_count).label("days_sum")
        ).where(
            and_(
                LeaveRequest.employment_id == employment_id,
                LeaveRequest.status.in_(["approved", "pending"]),
                LeaveRequest.start_date >= date(year, 1, 1),
                LeaveRequest.start_date <= date(year, 12, 31)
            )
        ).group_by(LeaveRequest.leave_type_id, LeaveRequest.status)
        usage_res = await self.db.execute(usage_stmt)

        usage_map: dict = {}
        for row in usage_res.all():
            tid, status, dsum = row
            if tid not in usage_map:
                usage_map[tid] = {"approved": 0.0, "pending": 0.0}
            usage_map[tid][status] = float(dsum)

        # Fetch explicit entitlement records
        ent_stmt = select(LeaveEntitlement).where(
            and_(
                LeaveEntitlement.employment_id == employment_id,
                LeaveEntitlement.year == year
            )
        )
        ent_res = await self.db.execute(ent_stmt)
        ent_dict = {ent.leave_type_id: ent for ent in ent_res.scalars().all()}

        # Calculate tenure as at end of requested year (or today if current year)
        check_date = date(year, 12, 31) if year < date.today().year else date.today()
        tenure_months = self.get_tenure_months(emp.join_date, check_date)

        # Build pool usage map: {pool_id: total_days_used}
        pool_usage: dict[uuid.UUID, float] = {}
        for lt in leave_types:
            if lt.pool_id:
                used = usage_map.get(lt.id, {"approved": 0.0, "pending": 0.0})
                pool_usage[lt.pool_id] = pool_usage.get(lt.pool_id, 0.0) + used["approved"] + used["pending"]

        balances = []
        for lt in leave_types:
            usage = usage_map.get(lt.id, {"approved": 0.0, "pending": 0.0})
            used = usage["approved"]
            pending = usage["pending"]
            ent = ent_dict.get(lt.id)
            carried = float(ent.carried_over_days) if ent else 0.0

            # Resolve total entitlement
            total = 0.0
            if ent:
                total = float(ent.total_days)  # stored record is authoritative
            elif lt.is_statutory:
                # Resolve dynamically from DB rule
                total = await self.resolve_entitlement(
                    emp.entity_id, lt.code, emp.join_date, check_date, 0.0
                )

            # Available = Total − Used − Pending
            available = total - used - pending

            # Pool types: also subtract other-type usage from the same pool
            if lt.pool_id and lt.pool_id in pool_usage:
                # available already accounts for this type's own usage;
                # subtract other types' pool usage too
                pool_total_used = pool_usage[lt.pool_id]
                this_type_used = used + pending
                other_pool_used = pool_total_used - this_type_used
                available = available - other_pool_used

                # Fetch pool cap
                pool_stmt = select(LeavePool).where(LeavePool.id == lt.pool_id)
                pool_res = await self.db.execute(pool_stmt)
                pool = pool_res.scalar_one_or_none()
                if pool:
                    pool_available = float(pool.cap_days) - pool_total_used
                    available = min(available, pool_available)

            balances.append({
                "leave_type_id": str(lt.id),
                "leave_type_name": lt.name,
                "leave_type_code": lt.code,
                "total_days": total,
                "used_days": used,
                "pending_days": pending,
                "carried_over_days": carried,
                "available_days": max(0.0, available),
                "is_statutory": lt.is_statutory,
                "is_paid": lt.is_paid,
                "tenure_months": tenure_months,
                "pool_code": lt.pool.code if lt.pool_id and lt.pool else None,
            })

        return balances

    # ─────────────────────────────────────────────
    # Get All Leave Requests (Entity Admin View)
    # ─────────────────────────────────────────────

    async def get_entity_leave_requests(
        self,
        entity_id: uuid.UUID,
        status: Optional[str] = None
    ) -> List[dict]:
        """Returns all leave requests for an entity with employee profile details."""
        stmt = select(
            LeaveRequest,
            LeaveType.name.label("leave_type_name"),
            Person.full_name,
            Employment.employee_code
        ).join(LeaveType).join(Employment).join(Person).where(
            Employment.entity_id == entity_id
        )
        if status:
            stmt = stmt.where(LeaveRequest.status == status)
        stmt = stmt.order_by(LeaveRequest.created_at.desc())

        result = await self.db.execute(stmt)
        requests = []
        for row in result.all():
            req, leave_name, full_name, emp_code = row
            requests.append({
                "id": req.id,
                "employment_id": req.employment_id,
                "employee_name": full_name,
                "employee_code": emp_code,
                "leave_type_name": leave_name,
                "start_date": req.start_date,
                "end_date": req.end_date,
                "days_count": float(req.days_count),
                "status": req.status,
                "reason": req.reason,
                "attachment_url": req.attachment_url,
                "created_at": req.created_at
            })
        return requests

    # ─────────────────────────────────────────────
    # Approve / Reject / Cancel Leave Request
    # ─────────────────────────────────────────────

    async def update_leave_request(
        self,
        request_id: uuid.UUID,
        status: str,
        admin_user_id: uuid.UUID,
        rejection_reason: Optional[str] = None
    ):
        """
        Updates status of a leave request (pending → approved/rejected/cancelled).
        Adjusts entitlement ledger accordingly.
        """
        stmt = select(LeaveRequest).where(LeaveRequest.id == request_id)
        res = await self.db.execute(stmt)
        request = res.scalar_one_or_none()

        if not request:
            raise ValueError("Leave request not found.")
        if request.status == status:
            return request

        old_status = request.status
        request.status = status
        request.approved_by = admin_user_id
        request.approved_at = datetime.now()
        if status == "rejected":
            request.rejection_reason = rejection_reason

        # Adjust static entitlement ledger (if record exists)
        ent_stmt = select(LeaveEntitlement).where(
            and_(
                LeaveEntitlement.employment_id == request.employment_id,
                LeaveEntitlement.leave_type_id == request.leave_type_id,
                LeaveEntitlement.year == request.start_date.year
            )
        )
        ent_res = await self.db.execute(ent_stmt)
        entitlement = ent_res.scalar_one_or_none()

        if entitlement:
            # Reverse old status
            if old_status == "pending":
                entitlement.pending_days = max(0.0, float(entitlement.pending_days) - float(request.days_count))
            elif old_status == "approved":
                entitlement.used_days = max(0.0, float(entitlement.used_days) - float(request.days_count))

            # Apply new status
            if status == "pending":
                entitlement.pending_days = float(entitlement.pending_days) + float(request.days_count)
            elif status == "approved":
                entitlement.used_days = float(entitlement.used_days) + float(request.days_count)

        await self.db.flush()
        return request

    # ─────────────────────────────────────────────
    # Admin: Get Statutory Rules — for management UI
    # ─────────────────────────────────────────────

    async def list_statutory_rules(self) -> List[dict]:
        """Returns all statutory leave rules for admin display."""
        stmt = select(StatutoryLeaveRule).order_by(
            StatutoryLeaveRule.leave_type_code,
            StatutoryLeaveRule.effective_from.desc()
        )
        res = await self.db.execute(stmt)
        rules = res.scalars().all()
        return [
            {
                "id": str(r.id),
                "leave_type_code": r.leave_type_code,
                "effective_from": str(r.effective_from),
                "effective_to": str(r.effective_to) if r.effective_to else None,
                "tenure_unit": r.tenure_unit,
                "progression": r.progression,
                "notes": r.notes,
            }
            for r in rules
        ]

    async def list_leave_pools(self, entity_id: uuid.UUID) -> List[dict]:
        """Returns all leave pools for an entity."""
        stmt = select(LeavePool).where(LeavePool.entity_id == entity_id).order_by(
            LeavePool.effective_from.desc()
        )
        res = await self.db.execute(stmt)
        pools = res.scalars().all()
        return [
            {
                "id": str(p.id),
                "code": p.code,
                "name": p.name,
                "cap_days": float(p.cap_days),
                "scope": p.scope,
                "effective_from": str(p.effective_from),
                "effective_to": str(p.effective_to) if p.effective_to else None,
            }
            for p in pools
        ]

    # ─────────────────────────────────────────────
    # Backward Compatibility: Legacy Helper Methods
    # (kept to avoid breaking any existing callers)
    # ─────────────────────────────────────────────

    def get_statutory_annual_limit(self, join_date: date, current_date: date) -> float:
        """
        Legacy sync helper. Use get_statutory_limit('ANNUAL', ...) for new code.
        Retained to not break existing callers during transition.
        """
        tenure_months = self.get_tenure_months(join_date, current_date)
        completed_years = tenure_months // 12
        return float(min(7 + completed_years, 14))

    def get_statutory_sick_limits(self, tenure_months: int) -> tuple[float, float]:
        """
        Legacy sync helper. Returns (outpatient_cap, pool_cap).
        Use get_statutory_limit() for new engine code.
        """
        if tenure_months < 3: return 0.0, 0.0
        if tenure_months == 3: return 5.0, 15.0
        if tenure_months == 4: return 8.0, 30.0
        if tenure_months == 5: return 11.0, 45.0
        return 14.0, 60.0

    async def get_entitlements(
        self,
        entity_id: uuid.UUID,
        year: int,
        search_query: Optional[str] = None
    ) -> List[dict]:
        """
        Returns all leave entitlements for an entity's employees in a specific year.
        Supports filtering by employee name or code.
        """
        stmt = (
            select(
                LeaveEntitlement,
                LeaveType,
                Person.full_name,
                Employment.employee_code
            )
            .join(LeaveType, LeaveEntitlement.leave_type_id == LeaveType.id)
            .join(Employment, LeaveEntitlement.employment_id == Employment.id)
            .join(Person, Employment.person_id == Person.id)
            .where(
                Employment.entity_id == entity_id,
                LeaveEntitlement.year == year
            )
        )

        if search_query:
            stmt = stmt.where(
                or_(
                    Person.full_name.ilike(f"%{search_query}%"),
                    Employment.employee_code.ilike(f"%{search_query}%")
                )
            )

        stmt = stmt.order_by(Person.full_name, LeaveType.name)
        result = await self.db.execute(stmt)
        
        entitlements = []
        for ent, ltype, name, code in result.all():
            entitlements.append({
                "id": ent.id,
                "employment_id": ent.employment_id,
                "employee_name": name,
                "employee_code": code,
                "leave_type_id": ent.leave_type_id,
                "leave_type_name": ltype.name,
                "leave_type_code": ltype.code,
                "year": ent.year,
                "total_days": float(ent.total_days),
                "used_days": float(ent.used_days),
                "pending_days": float(ent.pending_days),
                "carried_over_days": float(ent.carried_over_days)
            })
        return entitlements

    async def update_entitlement(
        self,
        entitlement_id: uuid.UUID,
        total_days: Optional[float] = None,
        carried_over_days: Optional[float] = None
    ) -> LeaveEntitlement:
        """Manually updates an entitlement record's days."""
        stmt = select(LeaveEntitlement).where(LeaveEntitlement.id == entitlement_id)
        res = await self.db.execute(stmt)
        ent = res.scalar_one_or_none()
        
        if not ent:
            raise ValueError("Entitlement record not found.")

        if total_days is not None:
            # Enforce Statutory Minimums (Admin Override only allows >= statutory)
            emp_stmt = select(Employment).where(Employment.id == ent.employment_id)
            emp = (await self.db.execute(emp_stmt)).scalar_one_or_none()
            ltype_stmt = select(LeaveType).where(LeaveType.id == ent.leave_type_id)
            ltype = (await self.db.execute(ltype_stmt)).scalar_one_or_none()

            if emp and ltype:
                # Resolve the base entitlement dynamically
                check_date = date(ent.year, 12, 31)
                statutory_minimum = await self.resolve_entitlement(
                    emp.entity_id, ltype.code, emp.join_date, check_date, 0.0
                )
                
                if total_days < statutory_minimum:
                    raise ValueError(
                        f"Compliance Error: The MOM/Company statutory minimum for "
                        f"{ltype.name} is {statutory_minimum} days. You cannot set the entitlement "
                        f"to {total_days} days."
                    )
            
            ent.total_days = total_days

        if carried_over_days is not None:
            ent.carried_over_days = carried_over_days

        await self.db.flush()
        return ent


    async def create_entitlement(
        self,
        employment_id: uuid.UUID,
        leave_type_id: uuid.UUID,
        year: int,
        total_days: float,
        carried_over_days: float = 0.0
    ) -> LeaveEntitlement:
        """Manually creates a new entitlement record."""
        # Check if already exists
        check_stmt = select(LeaveEntitlement).where(
            and_(
                LeaveEntitlement.employment_id == employment_id,
                LeaveEntitlement.leave_type_id == leave_type_id,
                LeaveEntitlement.year == year
            )
        )
        res = await self.db.execute(check_stmt)
        if res.scalar_one_or_none():
            raise ValueError("Entitlement already exists for this employee, leave type, and year.")

        # Enforce Statutory Minimums (Admin Override only allows >= statutory)
        emp_stmt = select(Employment).where(Employment.id == employment_id)
        emp = (await self.db.execute(emp_stmt)).scalar_one_or_none()
        ltype_stmt = select(LeaveType).where(LeaveType.id == leave_type_id)
        ltype = (await self.db.execute(ltype_stmt)).scalar_one_or_none()

        if emp and ltype:
            check_date = date(year, 12, 31)
            statutory_minimum = await self.resolve_entitlement(
                emp.entity_id, ltype.code, emp.join_date, check_date, 0.0
            )
            
            if total_days < statutory_minimum:
                raise ValueError(
                    f"Compliance Error: The MOM/Company statutory minimum for "
                    f"{ltype.name} is {statutory_minimum} days. You cannot set the entitlement "
                    f"to {total_days} days."
                )

        new_ent = LeaveEntitlement(
            employment_id=employment_id,
            leave_type_id=leave_type_id,
            year=year,
            total_days=total_days,
            carried_over_days=carried_over_days,
            used_days=0.0,
            pending_days=0.0
        )
        self.db.add(new_ent)
        await self.db.flush()

        return new_ent

    @staticmethod
    def get_standard_leave_configs():
        """Returns the master list of standard Singapore leave type configurations."""
        return [
            # Statutory
            {"code": "AL", "name": "Annual Leave", "is_paid": True, "is_statutory": True, "pool_sub_cap": None, "category": "Statutory"},
            {"code": "ML", "name": "Medical (Outpatient)", "is_paid": True, "is_statutory": True, "pool_sub_cap": 14.0, "category": "Statutory"},
            {"code": "HL", "name": "Hospitalisation", "is_paid": True, "is_statutory": True, "pool_sub_cap": None, "category": "Statutory"},
            {"code": "CL", "name": "Childcare Leave", "is_paid": True, "is_statutory": True, "pool_sub_cap": None, "category": "Statutory"},
            {"code": "ECL", "name": "Extended Childcare", "is_paid": True, "is_statutory": True, "pool_sub_cap": None, "category": "Statutory"},
            {"code": "MAT", "name": "Maternity (GPML)", "is_paid": True, "is_statutory": True, "pool_sub_cap": None, "category": "Statutory"},
            {"code": "PAT", "name": "Paternity (GPPL)", "is_paid": True, "is_statutory": True, "pool_sub_cap": None, "category": "Statutory"},
            {"code": "SPL", "name": "Shared Parental", "is_paid": True, "is_statutory": True, "pool_sub_cap": None, "category": "Statutory"},
            {"code": "UPL", "name": "Unpaid Infant Care", "is_paid": False, "is_statutory": True, "pool_sub_cap": None, "category": "Statutory"},
            
            # Company Benefits (Non-Statutory)
            {"code": "MAR", "name": "Marriage Leave", "is_paid": True, "is_statutory": False, "pool_sub_cap": None, "category": "Company Benefits"},
            {"code": "COM", "name": "Compassionate Leave", "is_paid": True, "is_statutory": False, "pool_sub_cap": None, "category": "Company Benefits"},
            {"code": "BDAY", "name": "Birthday Leave", "is_paid": True, "is_statutory": False, "pool_sub_cap": None, "category": "Company Benefits"},
            {"code": "OIL", "name": "Off-in-Lieu", "is_paid": True, "is_statutory": False, "pool_sub_cap": None, "category": "Company Benefits"},
            {"code": "VOL", "name": "Volunteer Leave", "is_paid": True, "is_statutory": False, "pool_sub_cap": None, "category": "Company Benefits"},
        ]

    async def seed_standard_leave_types(self, entity_id: uuid.UUID, codes: Optional[List[str]] = None) -> dict:
        """
        Seeds standard MOM statutory leave types and common company benefits for an entity.
        Includes shared SICK_HOSP_POOL (60 days).
        If codes is provided, only seeds those types.
        """
        all_configs = self.get_standard_leave_configs()
        
        if codes:
            leave_configs = [c for c in all_configs if c["code"] in codes]
        else:
            leave_configs = all_configs

        if not leave_configs:
            return {"created": 0, "skipped": 0}

        # 1. Setup Shared Sick & Hospitalisation Pool (Required for MOM Compliance)
        # Only if ML or HL are being seeded
        sick_codes = ["ML", "HL"]
        has_sick = any(c["code"] in sick_codes for c in leave_configs)
        sick_pool_id = None

        if has_sick:
            pool_code = "SICK_HOSP_POOL"
            stmt = select(LeavePool).where(and_(LeavePool.entity_id == entity_id, LeavePool.code == pool_code))
            sick_pool = (await self.db.execute(stmt)).scalar_one_or_none()
            
            if not sick_pool:
                sick_pool = LeavePool(
                    entity_id=entity_id,
                    code=pool_code,
                    name="Sick & Hospitalisation Pool",
                    cap_days=60.0,
                    scope="employment",
                    effective_from=date(2024, 1, 1)
                )
                self.db.add(sick_pool)
                await self.db.flush()
            sick_pool_id = sick_pool.id

        # 2. Define Standard Leave Types
        created = 0
        skipped = 0
        
        for config in leave_configs:
            code = config["code"]
            name = config["name"]
            is_paid = config["is_paid"]
            is_statutory = config["is_statutory"]
            p_sub_cap = config["pool_sub_cap"]

            stmt = select(LeaveType).where(and_(LeaveType.entity_id == entity_id, LeaveType.code == code))
            lt = (await self.db.execute(stmt)).scalar_one_or_none()
            
            p_id = sick_pool_id if code in sick_codes else None

            if not lt:
                lt = LeaveType(
                    entity_id=entity_id,
                    code=code,
                    name=name,
                    is_paid=is_paid,
                    is_statutory=is_statutory,
                    pool_id=p_id,
                    pool_sub_cap=p_sub_cap,
                    is_active=True
                )
                self.db.add(lt)
                created += 1
            else:
                # Update existing if needed (e.g. attaching to pool)
                lt.pool_id = p_id
                lt.pool_sub_cap = p_sub_cap
                skipped += 1
        
        await self.db.flush()
        return {"created": created, "skipped": skipped}
