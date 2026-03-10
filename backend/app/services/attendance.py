from typing import Optional, List
from datetime import datetime, date, timedelta, timezone
import uuid

SGT = timezone(timedelta(hours=8))
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from sqlalchemy.orm import selectinload
from app.models.attendance import AttendanceRecord, DailyAttendance, Shift, ShiftRoster, ShiftBreak, PublicHoliday
from app.models.employment import Employment
from app.models.tenant import Entity
from app.schemas.attendance import (
    ShiftCreate, ShiftUpdate, RosterBulkUpdate, ShiftBreakCreate,
    AttendanceRecordCreate, AttendanceRecordUpdate
)

class AttendanceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def punch(self, entity_id: uuid.UUID, employment_id: uuid.UUID, punch_type: str, timestamp: datetime, source: str = "web"):
        """
        Records a punch in or punch out event.
        """
        work_date = timestamp.date()
        
        # Check for existing record for today
        stmt = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.employment_id == employment_id,
                AttendanceRecord.work_date == work_date
            )
        )
        result = await self.db.execute(stmt)
        record = result.scalar_one_or_none()
        
        if not record:
            if punch_type == "out":
                # Cannot punch out before punching in
                raise ValueError("Cannot punch out without initial punch in for today")
            
            record = AttendanceRecord(
                employment_id=employment_id,
                entity_id=entity_id,
                work_date=work_date,
                clock_in=timestamp,
                source=source
            )
            self.db.add(record)
        else:
            if punch_type == "in":
                # Already punched in, update clock_in (allow re-punch-in if not yet punched out?)
                # For now, let's assume one punch-in/out pair per day
                record.clock_in = timestamp
            else:
                record.clock_out = timestamp
        
        await self.db.flush()
        return record

    async def get_attendance_records(
        self, 
        entity_id: uuid.UUID, 
        start_date: date, 
        end_date: date, 
        employment_id: Optional[uuid.UUID] = None
    ) -> List[dict]:
        from app.models.employment import Person
        from sqlalchemy import and_, select
        
        query = (
            select(AttendanceRecord, Person.full_name, Entity.attendance_roster_mode)
            .join(Employment, AttendanceRecord.employment_id == Employment.id)
            .join(Person, Employment.person_id == Person.id)
            .join(Entity, AttendanceRecord.entity_id == Entity.id)
            .where(
                and_(
                    AttendanceRecord.entity_id == entity_id,
                    AttendanceRecord.work_date >= start_date,
                    AttendanceRecord.work_date <= end_date
                )
            )
            .order_by(AttendanceRecord.work_date.desc(), AttendanceRecord.clock_in.desc())
        )
        
        if employment_id:
            query = query.where(AttendanceRecord.employment_id == employment_id)
            
        result = await self.db.execute(query)
        rows = result.all()
        
        records = []
        for rec, name, roster_mode in rows:
            # We'll return a dict that matches AttendanceRecordRead
            rec_dict = {
                "id": rec.id,
                "employment_id": rec.employment_id,
                "work_date": rec.work_date,
                "clock_in": rec.clock_in,
                "clock_out": rec.clock_out,
                "source": rec.source,
                "is_approved": rec.is_approved,
                "employee_name": name,
                "attendance_roster_mode": roster_mode
            }
            records.append(rec_dict)
            
        return records

    async def create_manual_punch(self, data: AttendanceRecordCreate) -> AttendanceRecord:
        record = AttendanceRecord(**data.model_dump())
        self.db.add(record)
        await self.db.flush()
        return record

    async def update_attendance_record(self, record_id: uuid.UUID, data: AttendanceRecordUpdate) -> Optional[AttendanceRecord]:
        stmt = select(AttendanceRecord).where(AttendanceRecord.id == record_id)
        result = await self.db.execute(stmt)
        record = result.scalar_one_or_none()
        
        if not record:
            return None
            
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(record, key, value)
            
        await self.db.flush()
        return record

    async def delete_attendance_record(self, record_id: uuid.UUID) -> bool:
        stmt = delete(AttendanceRecord).where(AttendanceRecord.id == record_id)
        result = await self.db.execute(stmt)
        return result.rowcount > 0

    async def preview_timesheet_data(self, entity_id: uuid.UUID, file_content: bytes, filename: str) -> dict:
        import pandas as pd
        import io
        from app.models.employment import Employment, Person

        try:
            if filename.endswith('.csv'):
                df = pd.read_csv(io.BytesIO(file_content))
            else:
                df = pd.read_excel(io.BytesIO(file_content))
        except Exception as e:
            raise ValueError(f"Failed to read file: {str(e)}")

        df.columns = df.columns.astype(str).str.strip().str.lower()
        col_mapping = {
            "employee id": "employee_id",
            "date": "date",
            "clock in": "clock_in",
            "clock out": "clock_out"
        }
        actual_cols = {}
        for expected, internal in col_mapping.items():
            for col in df.columns:
                if col.startswith(expected):
                    actual_cols[internal] = col
                    break
                    
        if "employee_id" not in actual_cols or "date" not in actual_cols:
            raise ValueError("CSV/Excel must contain at least 'Employee ID' and 'Date' columns.")

        # Bulk fetch employments and names for this entity
        stmt = (
            select(Employment.id, Employment.employee_code, Person.full_name)
            .join(Person, Employment.person_id == Person.id)
            .where(
                and_(
                    Employment.entity_id == entity_id,
                    Employment.is_active == True
                )
            )
        )
        employments = (await self.db.execute(stmt)).all()
        emp_code_map = {str(emp.employee_code).strip().upper(): {"id": emp.id, "name": emp.full_name} for emp in employments if emp.employee_code}

        preview_data = []
        valid_rows = 0
        invalid_rows = 0
        
        seen_file_records = set()

        for index, row in df.iterrows():
            row_idx = index + 2
            emp_code = str(row.get(actual_cols["employee_id"], "")).strip().upper()
            
            # Skip completely empty rows
            if pd.isna(emp_code) or not emp_code or emp_code == 'NAN':
                continue

            preview_row = {
                "row_index": row_idx,
                "employee_code": emp_code,
                "employment_id": None,
                "employee_name": None,
                "work_date": None,
                "clock_in": None,
                "clock_out": None,
                "is_valid": True,
                "validation_errors": []
            }

            if emp_code not in emp_code_map:
                preview_row["is_valid"] = False
                preview_row["validation_errors"].append(f"Employee ID '{emp_code}' not found.")
            else:
                preview_row["employment_id"] = emp_code_map[emp_code]["id"]
                preview_row["employee_name"] = emp_code_map[emp_code]["name"]

            raw_date = row.get(actual_cols["date"])
            if pd.isna(raw_date):
                preview_row["is_valid"] = False
                preview_row["validation_errors"].append("Missing Date.")
            else:
                try:
                    work_date = pd.to_datetime(raw_date).date()
                    preview_row["work_date"] = work_date
                except:
                    preview_row["is_valid"] = False
                    preview_row["validation_errors"].append("Invalid Date format.")

            if preview_row["work_date"]:
                # --- Fuzzy Time Parser Helper ---
                def parse_fuzzy_time(time_str: str) -> Optional[datetime]:
                    if pd.isna(time_str) or not str(time_str).strip():
                        return None
                    
                    time_str = str(time_str).strip().upper()
                    
                    # Already a datetime object from Excel
                    if isinstance(time_str, datetime):
                        return time_str
                    
                    # 1. Clean common noise
                    time_str = time_str.replace("HRS", "").replace("HR", "").strip()
                    
                    # 2. Convert standard decimal formatting (e.g. 18.30 -> 18:30)
                    import re
                    if re.match(r'^\d{1,2}\.\d{2}(\s*[A-Z]{2})?$', time_str):
                        time_str = time_str.replace('.', ':', 1)
                        
                    # 3. Handle Military Time without colon (e.g. 800 -> 08:00, 0900 -> 09:00, 1830 -> 18:30)
                    if re.match(r'^\d{3,4}$', time_str):
                        if len(time_str) == 3:
                            time_str = f"0{time_str[0]}:{time_str[1:]}"
                        else:
                            time_str = f"{time_str[:2]}:{time_str[2:]}"
                        
                    # 4. Handle edge cases like "9" -> "09:00"
                    if re.match(r'^\d{1,2}$', time_str):
                        time_str = f"{time_str}:00"
                        
                    try:
                        from dateutil import parser
                        parsed = parser.parse(time_str)
                        return parsed
                    except:
                        return None
                # -------------------------------
                
                # Parse Times
                if "clock_in" in actual_cols:
                    raw_in = row.get(actual_cols["clock_in"])
                    parsed_in = parse_fuzzy_time(raw_in)
                    if parsed_in:
                        if parsed_in.year == 1900 or parsed_in.year == datetime.now().year:
                            # It only returned a time component
                            preview_row["clock_in"] = datetime.combine(preview_row["work_date"], parsed_in.time(), tzinfo=SGT)
                        else:
                            preview_row["clock_in"] = parsed_in.replace(tzinfo=SGT) if parsed_in.tzinfo is None else parsed_in
                    elif pd.notna(raw_in) and str(raw_in).strip():
                        preview_row["is_valid"] = False
                        preview_row["validation_errors"].append(f"Uncrecognized Clock In format: '{raw_in}'")

                if "clock_out" in actual_cols:
                    raw_out = row.get(actual_cols["clock_out"])
                    parsed_out = parse_fuzzy_time(raw_out)
                    if parsed_out:
                        if parsed_out.year == 1900 or parsed_out.year == datetime.now().year:
                            preview_row["clock_out"] = datetime.combine(preview_row["work_date"], parsed_out.time(), tzinfo=SGT)
                        else:
                            preview_row["clock_out"] = parsed_out.replace(tzinfo=SGT) if parsed_out.tzinfo is None else parsed_out
                        
                        # Handle overnight shifts intuitively in parser if out < in without date provided
                        if preview_row["clock_in"] and preview_row["clock_out"] and preview_row["clock_out"] < preview_row["clock_in"]:
                             # Only if the original parser only outputted a time (year 1900 fallback typical of dateutil)
                             if parsed_out.year == 1900 or parsed_out.year == datetime.now().year:
                                 preview_row["clock_out"] += timedelta(days=1)
                                 
                    elif pd.notna(raw_out) and str(raw_out).strip():
                        preview_row["is_valid"] = False
                        preview_row["validation_errors"].append(f"Uncrecognized Clock Out format: '{raw_out}'")

                if not preview_row["clock_in"] and not preview_row["clock_out"]:
                    preview_row["is_valid"] = False
                    preview_row["validation_errors"].append("No valid Clock In or Out time.")

            if preview_row["is_valid"] and preview_row["work_date"] and preview_row["employment_id"]:
                record_key = (preview_row["employment_id"], preview_row["work_date"])
                if record_key in seen_file_records:
                    preview_row["is_valid"] = False
                    preview_row["validation_errors"].append("Duplicate record in uploaded file for this date.")
                else:
                    seen_file_records.add(record_key)
                    
                    # Also check DB for existing record
                    rec_stmt = select(AttendanceRecord).where(
                        and_(
                            AttendanceRecord.employment_id == preview_row["employment_id"],
                            AttendanceRecord.work_date == preview_row["work_date"]
                        )
                    )
                    existing_db = (await self.db.execute(rec_stmt)).scalar_one_or_none()
                    if existing_db:
                        preview_row["is_valid"] = False
                        preview_row["validation_errors"].append("Timesheet for this date already exists in database.")

            if preview_row["is_valid"]:
                valid_rows += 1
                
                # Fetch OT Breakdowns
                calculated = await self._calculate_attendance_hours(
                    entity_id=entity_id,
                    emp_id=preview_row["employment_id"],
                    work_date=preview_row["work_date"],
                    clock_in=preview_row["clock_in"],
                    clock_out=preview_row["clock_out"]
                )
                preview_row["normal_hours"] = calculated["normal_hours"]
                preview_row["ot_hours_1_5x"] = calculated["ot_hours_1_5x"]
                preview_row["ot_hours_2x"] = calculated["ot_hours_2x"]
                preview_row["lateness_mins"] = calculated.get("lateness_mins", 0)
                preview_row["early_exit_mins"] = calculated.get("early_exit_mins", 0)
                preview_row["calculation_breakdown"] = calculated.get("calculation_breakdown", [])
                if "matched_shift_name" in calculated:
                    preview_row["matched_shift_name"] = calculated["matched_shift_name"]
                
            else:
                invalid_rows += 1
                
            preview_data.append(preview_row)

        return {
            "total_rows": len(preview_data),
            "valid_rows": valid_rows,
            "invalid_rows": invalid_rows,
            "data": preview_data
        }

    async def confirm_timesheet_import(self, entity_id: uuid.UUID, records: List[dict]) -> dict:
        success_count = 0
        errors = []

        for index, item in enumerate(records):
            try:
                emp_id = uuid.UUID(str(item["employment_id"]))
                work_date_str = item["work_date"]
                work_date = date.fromisoformat(work_date_str) if isinstance(work_date_str, str) else work_date_str
                
                # We need to handle tz-aware datetime from ISO string parsing
                clock_in = None
                if item.get("clock_in"):
                    clock_in = datetime.fromisoformat(str(item["clock_in"]).replace('Z', '+00:00'))

                clock_out = None
                if item.get("clock_out"):
                    clock_out = datetime.fromisoformat(str(item["clock_out"]).replace('Z', '+00:00'))

            except Exception as e:
                errors.append({"row": index + 1, "error": f"Payload parsing error: {str(e)}"})
                continue

            rec_stmt = select(AttendanceRecord).where(
                and_(
                    AttendanceRecord.employment_id == emp_id,
                    AttendanceRecord.work_date == work_date
                )
            )
            existing_record = (await self.db.execute(rec_stmt)).scalar_one_or_none()

            try:
                if existing_record:
                    if clock_in: existing_record.clock_in = clock_in
                    if clock_out: existing_record.clock_out = clock_out
                    existing_record.source = "bulk_import"
                else:
                    new_record = AttendanceRecord(
                        employment_id=emp_id,
                        entity_id=entity_id,
                        work_date=work_date,
                        clock_in=clock_in,
                        clock_out=clock_out,
                        source="bulk_import"
                    )
                    self.db.add(new_record)
                
                success_count += 1
            except Exception as e:
                errors.append({"row": index + 1, "error": f"DB upsert error: {str(e)}"})

        await self.db.flush()
        
        return {
            "success_count": success_count,
            "error_count": len(errors),
            "errors": errors
        }
    # --- Shift Management ---

    async def create_shift(self, shift_in: "ShiftCreate") -> Shift:
        shift = Shift(**shift_in.model_dump())
        self.db.add(shift)
        await self.db.flush()
        await self.db.refresh(shift, ["breaks"])
        return shift

    async def get_shifts(self, entity_id: uuid.UUID) -> List[Shift]:
        stmt = select(Shift).where(
            and_(
                Shift.entity_id == entity_id,
                Shift.is_deleted == False
            )
        ).options(selectinload(Shift.breaks))
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_shift(self, shift_id: uuid.UUID) -> Optional[Shift]:
        stmt = select(Shift).where(
            and_(
                Shift.id == shift_id,
                Shift.is_deleted == False
            )
        ).options(selectinload(Shift.breaks))
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_shift(self, shift_id: uuid.UUID, shift_update: "ShiftUpdate") -> Shift:
        shift = await self.get_shift(shift_id)
        if not shift:
            raise ValueError("Shift not found")
        
        update_data = shift_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(shift, field, value)
        
        await self.db.flush()
        await self.db.refresh(shift, ["breaks"])
        return shift

    async def delete_shift(self, shift_id: uuid.UUID) -> None:
        stmt = select(Shift).where(Shift.id == shift_id)
        result = await self.db.execute(stmt)
        shift = result.scalar_one_or_none()
        if shift:
            shift.is_deleted = True
            await self.db.flush()

    # --- Shift Break Management ---

    async def get_shift_breaks(self, shift_id: uuid.UUID) -> List[ShiftBreak]:
        stmt = select(ShiftBreak).where(ShiftBreak.shift_id == shift_id).order_by(ShiftBreak.sort_order)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def replace_shift_breaks(self, shift_id: uuid.UUID, breaks_in: List[ShiftBreakCreate]) -> List[ShiftBreak]:
        """Delete all existing breaks for a shift and replace with new ones."""
        await self.db.execute(delete(ShiftBreak).where(ShiftBreak.shift_id == shift_id))
        new_breaks = []
        for brk_data in breaks_in:
            brk = ShiftBreak(
                shift_id=shift_id,
                label=brk_data.label,
                break_start=brk_data.break_start,
                break_end=brk_data.break_end,
                is_paid=brk_data.is_paid,
                sort_order=brk_data.sort_order
            )
            self.db.add(brk)
            new_breaks.append(brk)
        await self.db.flush()
        return new_breaks

    async def delete_shift_break(self, break_id: uuid.UUID) -> None:
        stmt = select(ShiftBreak).where(ShiftBreak.id == break_id)
        result = await self.db.execute(stmt)
        brk = result.scalar_one_or_none()
        if brk:
            await self.db.delete(brk)
            await self.db.flush()

    # --- Roster Management ---

    async def get_roster(self, entity_id: uuid.UUID, start_date: date, end_date: date, employment_id: Optional[uuid.UUID] = None) -> List[ShiftRoster]:
        stmt = select(ShiftRoster).where(
            and_(
                ShiftRoster.entity_id == entity_id,
                ShiftRoster.roster_date >= start_date,
                ShiftRoster.roster_date <= end_date
            )
        )
        if employment_id:
            stmt = stmt.where(ShiftRoster.employment_id == employment_id)
            
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def assign_roster_bulk(self, bulk_data: RosterBulkUpdate) -> List[ShiftRoster]:
        """
        Assigns shifts to multiple employees for a date range.
        Deletes existing roster entries for the same period first.
        """
        # 1. Clear existing roster for these employees in the date range
        clear_stmt = delete(ShiftRoster).where(
            and_(
                ShiftRoster.employment_id.in_(bulk_data.employment_ids),
                ShiftRoster.roster_date >= bulk_data.start_date,
                ShiftRoster.roster_date <= bulk_data.end_date
            )
        )
        await self.db.execute(clear_stmt)
        
        # 2. Create new roster entries
        new_rosters = []
        delta = bulk_data.end_date - bulk_data.start_date
        
        for emp_id in bulk_data.employment_ids:
            for i in range(delta.days + 1):
                roster_date = bulk_data.start_date + timedelta(days=i)
                roster = ShiftRoster(
                    employment_id=emp_id,
                    entity_id=bulk_data.entity_id,
                    roster_date=roster_date,
                    shift_id=bulk_data.shift_id,
                    day_type=bulk_data.day_type or "normal"
                )
                self.db.add(roster)
                new_rosters.append(roster)
        
        await self.db.flush()
        return new_rosters

    WEEKDAY_MAP = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6
    }

    async def auto_generate_roster(self, data) -> List[ShiftRoster]:
        """
        Smart roster generation using Employment.rest_day, working_days_per_week,
        and public holidays.
        """
        from app.schemas.attendance import RosterAutoGenerate

        # 1. Fetch employments to get rest_day and working_days_per_week
        emp_stmt = select(Employment).where(Employment.id.in_(data.employment_ids))
        emp_result = await self.db.execute(emp_stmt)
        employments = {e.id: e for e in emp_result.scalars().all()}

        # 2. Fetch public holidays for the date range
        ph_dates = await self.get_ph_dates_set(data.entity_id, data.start_date, data.end_date)

        # 3. Clear existing roster in date range
        clear_stmt = delete(ShiftRoster).where(
            and_(
                ShiftRoster.employment_id.in_(data.employment_ids),
                ShiftRoster.roster_date >= data.start_date,
                ShiftRoster.roster_date <= data.end_date
            )
        )
        await self.db.execute(clear_stmt)

        # 4. Generate roster entries
        new_rosters = []
        delta = data.end_date - data.start_date

        for emp_id in data.employment_ids:
            emp = employments.get(emp_id)
            if not emp:
                continue

            rest_day_num = self.WEEKDAY_MAP.get((emp.rest_day or "sunday").lower(), 6)
            work_days = float(emp.working_days_per_week or 6)

            for i in range(delta.days + 1):
                roster_date = data.start_date + timedelta(days=i)
                weekday = roster_date.weekday()

                if roster_date in ph_dates:
                    day_type = "public_holiday"
                    shift_id = None
                elif weekday == rest_day_num:
                    day_type = "rest_day"
                    shift_id = None
                elif work_days <= 5 and weekday == 5:  # Saturday for 5-day week
                    day_type = "off_day"
                    shift_id = None
                else:
                    day_type = "normal"
                    shift_id = data.shift_id

                roster = ShiftRoster(
                    employment_id=emp_id,
                    entity_id=data.entity_id,
                    roster_date=roster_date,
                    shift_id=shift_id,
                    day_type=day_type
                )
                self.db.add(roster)
                new_rosters.append(roster)

        await self.db.flush()
        return new_rosters

    async def update_roster_cell(self, roster_id: uuid.UUID, shift_id=None, day_type=None) -> Optional[ShiftRoster]:
        roster = await self.db.get(ShiftRoster, roster_id)
        if not roster:
            return None
        if shift_id is not None:
            roster.shift_id = shift_id
        if day_type is not None:
            roster.day_type = day_type
            # If rest_day or off_day, clear shift
            if day_type in ("rest_day", "off_day", "public_holiday"):
                roster.shift_id = None
        await self.db.flush()
        return roster

    async def delete_roster_cell(self, roster_id: uuid.UUID) -> bool:
        roster = await self.db.get(ShiftRoster, roster_id)
        if roster:
            await self.db.delete(roster)
            await self.db.flush()
            return True
        return False

    async def clear_roster(self, data) -> int:
        """Bulk clear roster for given employees and date range."""
        stmt = delete(ShiftRoster).where(
            and_(
                ShiftRoster.entity_id == data.entity_id,
                ShiftRoster.employment_id.in_(data.employment_ids),
                ShiftRoster.roster_date >= data.start_date,
                ShiftRoster.roster_date <= data.end_date
            )
        )
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount

    async def get_roster_enriched(self, entity_id: uuid.UUID, start_date: date, end_date: date, employment_id: Optional[uuid.UUID] = None):
        """Fetch roster with employee name and shift name."""
        from app.models.employment import Person
        
        stmt = (
            select(
                ShiftRoster,
                Person.full_name.label("employee_name"),
                Shift.name.label("shift_name")
            )
            .join(Employment, ShiftRoster.employment_id == Employment.id)
            .join(Person, Employment.person_id == Person.id)
            .outerjoin(Shift, ShiftRoster.shift_id == Shift.id)
            .where(
                and_(
                    ShiftRoster.entity_id == entity_id,
                    ShiftRoster.roster_date >= start_date,
                    ShiftRoster.roster_date <= end_date
                )
            )
        )
        if employment_id:
            stmt = stmt.where(ShiftRoster.employment_id == employment_id)

        stmt = stmt.order_by(Person.full_name, ShiftRoster.roster_date)
        result = await self.db.execute(stmt)
        rows = result.all()

        enriched = []
        for roster, emp_name, shift_name in rows:
            enriched.append({
                "id": roster.id,
                "employment_id": roster.employment_id,
                "entity_id": roster.entity_id,
                "roster_date": roster.roster_date,
                "shift_id": roster.shift_id,
                "day_type": roster.day_type,
                "employee_name": emp_name or "",
                "shift_name": shift_name
            })
        return enriched

    # --- Roster & Attendance Calculation ---

    async def find_best_shift_match(self, entity_id: uuid.UUID, clock_in: datetime) -> Optional[Shift]:
        """
        Calculates the best shift for a punch when no roster is assigned.
        Uses time distance between punch and shift start.
        """
        stmt = select(Shift).where(and_(Shift.entity_id == entity_id, Shift.is_deleted == False)).options(selectinload(Shift.breaks))
        result = await self.db.execute(stmt)
        shifts = result.scalars().all()
        
        if not shifts:
            return None
            
        punch_time = clock_in.astimezone(SGT).time()
        best_match = None
        min_distance = float('inf')
        
        # Convert punch_time to minutes from midnight for distance calculation
        punch_minutes = punch_time.hour * 60 + punch_time.minute
        
        for shift in shifts:
            shift_start_minutes = shift.start_time.hour * 60 + shift.start_time.minute
            
            # Simple distance
            distance = abs(punch_minutes - shift_start_minutes)
            
            # Handle wrap-around distance (e.g., 11 PM vs 1 AM)
            # 1440 minutes in a day
            distance = min(distance, 1440 - distance)
            
            # Heuristic: If shift is overnight and punch is late night, reduce distance
            if shift.is_overnight and (punch_minutes > 1200 or punch_minutes < 300):
                distance -= 120 # Give 2-hour bonus to overnight shifts at night
                
            if distance < min_distance:
                min_distance = distance
                best_match = shift
        
        return best_match

    async def _calculate_attendance_hours(self, entity_id: uuid.UUID, emp_id: uuid.UUID, work_date: date, clock_in: datetime | None, clock_out: datetime | None) -> dict:
        """
        Core reusable logic to compute Normal and OT hours for a given day.
        Returns a dict: { "actual_hours": float, "normal_hours": float, "ot_hours_1_5x": float, "ot_hours_2x": float }
        """
        res = {"actual_hours": 0.0, "normal_hours": 0.0, "ot_hours_1_5x": 0.0, "ot_hours_2x": 0.0, "calculation_breakdown": []}
        
        if not clock_in or not clock_out:
            return res
            
        steps = []
            
        # 1. Fetch Roster & Shift
        roster_stmt = select(ShiftRoster).where(
            and_(
                ShiftRoster.employment_id == emp_id,
                ShiftRoster.roster_date == work_date
            )
        )
        roster = (await self.db.execute(roster_stmt)).scalar_one_or_none()
        
        shift = None
        smart_match_applied = False
        if roster and roster.shift_id:
            shift = await self.get_shift(roster.shift_id)
        else:
            # Check Entity roster mode
            entity_stmt = select(Entity.attendance_roster_mode).where(Entity.id == entity_id)
            roster_mode = (await self.db.execute(entity_stmt)).scalar_one_or_none()
            if roster_mode == "smart_match":
                shift = await self.find_best_shift_match(entity_id, clock_in)
                if shift:
                    res["matched_shift_name"] = shift.name
                    smart_match_applied = True
                    
        if shift:
            prefix = "Smart-Match Shift: " if smart_match_applied else "Shift: "
            steps.append(f"{prefix}{shift.name} ({shift.start_time.strftime('%I:%M %p')} - {shift.end_time.strftime('%I:%M %p')})")
        else:
            steps.append("No shift assigned (Manual Roster Mode)")

        clock_in_str = clock_in.astimezone(SGT).strftime('%I:%M %p') if clock_in else "N/A"
        clock_out_str = clock_out.astimezone(SGT).strftime('%I:%M %p') if clock_out else "In Progress"
        steps.append(f"Punch: {clock_in_str} - {clock_out_str}")
        
        # 2. Fetch Employment for OT Eligibility
        emp_stmt = select(Employment.is_ot_eligible).where(Employment.id == emp_id)
        is_ot_eligible = (await self.db.execute(emp_stmt)).scalar_one_or_none()
        if is_ot_eligible is None:
            is_ot_eligible = True # Default
            
        # 3. Calculate Elapsed Time & Breaks
        work_delta = clock_out - clock_in
        total_elapsed_seconds = work_delta.total_seconds()
        steps.append(f"Elapsed: {int(total_elapsed_seconds // 3600)}h {int((total_elapsed_seconds % 3600) // 60)}m")
        
        total_break_seconds = 0
        if shift and shift.breaks:
            break_details = []
            for brk in shift.breaks:
                if brk.is_paid: continue
                brk_start_dt = datetime.combine(work_date, brk.break_start).replace(tzinfo=SGT)
                brk_end_dt = datetime.combine(work_date, brk.break_end).replace(tzinfo=SGT)
                if shift.start_time and brk.break_start < shift.start_time:
                    brk_start_dt += timedelta(days=1)
                    brk_end_dt += timedelta(days=1)
                if brk_end_dt <= brk_start_dt:
                    brk_end_dt += timedelta(days=1)
                    
                overlap_start = max(clock_in, brk_start_dt)
                overlap_end = min(clock_out, brk_end_dt)
                overlap_seconds = max(0, (overlap_end - overlap_start).total_seconds())
                total_break_seconds += overlap_seconds
                if overlap_seconds > 0:
                    break_details.append(f"{brk.label} ({int(overlap_seconds // 60)}m)")
            if break_details:
                steps.append(f"Breaks deducted: {', '.join(break_details)}")
        elif shift:
            total_break_seconds = shift.break_minutes * 60
            steps.append(f"Flat Break Deduction: {shift.break_minutes}m")
            
        actual_seconds = max(0, total_elapsed_seconds - total_break_seconds)
        actual_hours = actual_seconds / 3600.0
        res["actual_hours"] = actual_hours
        
        # 4. OT Calculation
        day_type = roster.day_type if roster else "normal"
        
        # --- Dynamic Day Type Resolution (if not provided by Roster) ---
        if day_type == "normal":
            # Check Public Holiday
            ph_dates = await self.get_ph_dates_set(entity_id, work_date, work_date)
            if work_date in ph_dates:
                day_type = "public_holiday"
            else:
                # Check Rest Day / Off Day dynamically using employment record
                emp_record = await self.db.get(Employment, emp_id)
                if emp_record:
                    rest_day_str = (emp_record.rest_day or "sunday").lower()
                    rest_day_num = self.WEEKDAY_MAP.get(rest_day_str, 6)
                    work_days = float(emp_record.working_days_per_week or 6)
                    weekday = work_date.weekday()
                    
                    if weekday == rest_day_num:
                        day_type = "rest_day"
                    elif work_days <= 5 and weekday == 5: # Saturday for 5-day week
                        day_type = "off_day"
        # ---------------------------------------------------------------
        
        scheduled_hours = float(shift.work_hours) if shift else 8.0
        
        if day_type == "rest_day" or day_type == "public_holiday":
            res["normal_hours"] = 0.0
            res["ot_hours_1_5x"] = 0.0
            res["ot_hours_2x"] = actual_hours
            steps.append(f"Rest Day/Public Holiday: {round(actual_hours, 2)}h OT 2.0x")
        else:
            res["normal_hours"] = min(actual_hours, scheduled_hours)
            if is_ot_eligible:
                res["ot_hours_1_5x"] = max(0, actual_hours - scheduled_hours)
            else:
                res["normal_hours"] = actual_hours
                res["ot_hours_1_5x"] = 0.0
            steps.append(f"Payable: {round(res['normal_hours'], 2)}h Normal" + (f", {round(res['ot_hours_1_5x'], 2)}h OT 1.5x" if res["ot_hours_1_5x"] > 0 else ""))
                
        # 5. Lateness & Early Exit
        res["lateness_mins"] = 0
        res["early_exit_mins"] = 0
        if shift:
            planned_start = datetime.combine(work_date, shift.start_time).replace(tzinfo=SGT)
            planned_end = datetime.combine(work_date, shift.end_time).replace(tzinfo=SGT)
            
            if shift.is_overnight:
                planned_end += timedelta(days=1)
            
            # Lateness
            if clock_in > planned_start:
                delay = (clock_in - planned_start).total_seconds() / 60.0
                if delay > shift.lateness_grace_minutes:
                    if shift.late_penalty_rounding_block > 0:
                        res["lateness_mins"] = int(((delay + shift.late_penalty_rounding_block - 0.001) // shift.late_penalty_rounding_block) * shift.late_penalty_rounding_block)
                    else:
                        res["lateness_mins"] = int(delay)
                    steps.append(f"Late: {res['lateness_mins']}m")
            
            # Early leave
            if clock_out < planned_end:
                early_exit_delay = (planned_end - clock_out).total_seconds() / 60.0
                if early_exit_delay > shift.early_exit_grace_minutes:
                    if shift.early_penalty_rounding_block > 0:
                        res["early_exit_mins"] = int(((early_exit_delay + shift.early_penalty_rounding_block - 0.001) // shift.early_penalty_rounding_block) * shift.early_penalty_rounding_block)
                    else:
                        res["early_exit_mins"] = int(early_exit_delay)
                    steps.append(f"Early Exit: {res['early_exit_mins']}m")
                
        # shift bonus
        if shift:
            res["ot_hours_1_5x"] += float(shift.offered_ot_1_5x)
            res["ot_hours_2x"] += float(shift.offered_ot_2_0x)
            if float(shift.offered_ot_1_5x) > 0 or float(shift.offered_ot_2_0x) > 0:
                steps.append(f"Bonus Shift OT: {float(shift.offered_ot_1_5x)}h (1.5x), {float(shift.offered_ot_2_0x)}h (2.0x)")
            
        res["calculation_breakdown"] = steps
        return res

    async def compute_daily_attendance(self, entity_id: uuid.UUID, work_date: date):
        """
        Processes all raw attendance records for a specific date and entity.
        Calculates hours, OT, lateness etc. based on rosters and shifts.
        """
        # Fetch Entity config for Roster Mode
        entity_stmt = select(Entity).where(Entity.id == entity_id)
        entity_result = await self.db.execute(entity_stmt)
        entity = entity_result.scalar_one_or_none()
        roster_mode = entity.attendance_roster_mode if entity else "manual"

        # Fetch all records for this entity and date
        stmt = select(AttendanceRecord).where(
            and_(
                AttendanceRecord.entity_id == entity_id,
                AttendanceRecord.work_date == work_date
            )
        )
        result = await self.db.execute(stmt)
        records = result.scalars().all()
        
        for record in records:
            # Detect status
            is_in_progress = record.clock_in and not record.clock_out
            
            if not record.clock_in:
                continue
            
            # 1. Fetch Roster & Shift
            roster_stmt = select(ShiftRoster).where(
                and_(
                    ShiftRoster.employment_id == record.employment_id,
                    ShiftRoster.roster_date == work_date
                )
            )
            roster_result = await self.db.execute(roster_stmt)
            roster = roster_result.scalar_one_or_none()
            
            shift = None
            smart_match_applied = False
            
            if roster and roster.shift_id:
                shift = await self.get_shift(roster.shift_id)
            elif roster_mode == "smart_match":
                # Attempt to find best fit if no manual roster
                shift = await self.find_best_shift_match(entity_id, record.clock_in)
                smart_match_applied = True
            
            # 2. Fetch Employment for OT Eligibility
            emp_stmt = select(Employment).where(Employment.id == record.employment_id)
            emp_result = await self.db.execute(emp_stmt)
            employment = emp_result.scalar_one_or_none()
            
            # 3. Calculate Durations
            steps = []
            if shift:
                prefix = "Smart-Match Shift: " if smart_match_applied else "Shift: "
                steps.append(f"{prefix}{shift.name} ({shift.start_time.strftime('%I:%M %p')} - {shift.end_time.strftime('%I:%M %p')})")
            else:
                steps.append("No shift assigned (Manual Roster Mode)")

            clock_in_str = record.clock_in.astimezone(SGT).strftime('%I:%M %p') if record.clock_in else "N/A"
            clock_out_str = record.clock_out.astimezone(SGT).strftime('%I:%M %p') if record.clock_out else "In Progress"
            steps.append(f"Punch: {clock_in_str} - {clock_out_str}")

            if is_in_progress:
                work_delta = datetime.now(record.clock_in.tzinfo) - record.clock_in
            else:
                work_delta = record.clock_out - record.clock_in
            total_elapsed_seconds = work_delta.total_seconds()
            steps.append(f"Elapsed: {int(total_elapsed_seconds // 3600)}h {int((total_elapsed_seconds % 3600) // 60)}m")
            
            # Subtract Breaks using overlap-based calculation
            total_break_seconds = 0
            if shift and shift.breaks:
                break_details = []
                for brk in shift.breaks:
                    if brk.is_paid:
                        continue  # Paid breaks are NOT deducted
                    # Build break window as datetimes
                    brk_start_dt = datetime.combine(work_date, brk.break_start)
                    brk_end_dt = datetime.combine(work_date, brk.break_end)
                    # Assign timezone (Assume SGT for shift times)
                    brk_start_dt = brk_start_dt.replace(tzinfo=SGT)
                    brk_end_dt = brk_end_dt.replace(tzinfo=SGT)
                    # Handle breaks that should be on next day
                    # If break_start < shift.start_time, it belongs to the next calendar day
                    if shift.start_time and brk.break_start < shift.start_time:
                        brk_start_dt += timedelta(days=1)
                        brk_end_dt += timedelta(days=1)
                    # Handle break_end < break_start (crosses midnight, e.g. 23:30-00:30)
                    if brk_end_dt <= brk_start_dt:
                        brk_end_dt += timedelta(days=1)
                    # Calculate overlap with actual work period
                    overlap_start = max(record.clock_in, brk_start_dt)
                    overlap_end = min(record.clock_out if record.clock_out else datetime.now(record.clock_in.tzinfo), brk_end_dt)
                    overlap_seconds = max(0, (overlap_end - overlap_start).total_seconds())
                    total_break_seconds += overlap_seconds
                    if overlap_seconds > 0:
                        break_details.append(f"{brk.label} ({int(overlap_seconds // 60)}m)")
                if break_details:
                    steps.append(f"Breaks deducted: {', '.join(break_details)}")

            elif shift:
                # Fallback: use flat break_minutes if no break windows defined
                total_break_seconds = shift.break_minutes * 60
                steps.append(f"Flat Break Deduction: {shift.break_minutes}m")
            
            actual_seconds = max(0, total_elapsed_seconds - total_break_seconds)
            actual_hours = actual_seconds / 3600.0
            
            # 4. Lateness & Early Leave (Only if shift exists)
            lateness = 0
            early_leave = 0
            
            if shift:
                # Compare times (Shift starts/ends are in SGT)
                planned_start = datetime.combine(work_date, shift.start_time).replace(tzinfo=SGT)
                planned_end = datetime.combine(work_date, shift.end_time).replace(tzinfo=SGT)
                
                # If overnight shift, planned_end is next day
                if shift.is_overnight:
                    planned_end += timedelta(days=1)
                
                # Lateness
                if record.clock_in > planned_start:
                    delay = (record.clock_in - planned_start).total_seconds() / 60.0
                    if delay > shift.lateness_grace_minutes:
                        if shift.late_penalty_rounding_block > 0:
                            # Round UP to nearest block (e.g., 6m -> 15m if block is 15)
                            lateness = int(((delay + shift.late_penalty_rounding_block - 0.001) // shift.late_penalty_rounding_block) * shift.late_penalty_rounding_block)
                        else:
                            lateness = int(delay)
                        steps.append(f"Late: {lateness}m")
                
                # Early Leave (only if clocked out)
                if not is_in_progress and record.clock_out < planned_end:
                    early_exit_delay = (planned_end - record.clock_out).total_seconds() / 60.0
                    if early_exit_delay > shift.early_exit_grace_minutes:
                        if shift.early_penalty_rounding_block > 0:
                            # Round UP to nearest block
                            early_leave = int(((early_exit_delay + shift.early_penalty_rounding_block - 0.001) // shift.early_penalty_rounding_block) * shift.early_penalty_rounding_block)
                        else:
                            early_leave = int(early_exit_delay)
                        steps.append(f"Early Exit: {early_leave}m")
            
            # 5. OT Calculation (Singapore Rules)
            # Skip OT for in-progress
            if is_in_progress:
                actual_hours = actual_seconds / 3600.0
                normal_hours = actual_hours
                ot_1_5 = 0.0
                ot_2_0 = 0.0
                scheduled_hours = float(shift.work_hours) if shift else 8.0
                steps.append(f"Actual Payable: {round(actual_hours, 2)}h (In Progress)")
            else:
                day_type = roster.day_type if roster else "normal"
                
                # --- Dynamic Day Type Resolution (if not provided by Roster) ---
                if day_type == "normal":
                    ph_dates = await self.get_ph_dates_set(entity_id, work_date, work_date)
                    if work_date in ph_dates:
                        day_type = "public_holiday"
                    elif employment:
                        rest_day_str = (employment.rest_day or "sunday").lower()
                        rest_day_num = self.WEEKDAY_MAP.get(rest_day_str, 6)
                        work_days = float(employment.working_days_per_week or 6)
                        weekday = work_date.weekday()
                        
                        if weekday == rest_day_num:
                            day_type = "rest_day"
                        elif work_days <= 5 and weekday == 5:
                            day_type = "off_day"
                # ---------------------------------------------------------------
                
                scheduled_hours = float(shift.work_hours) if shift else 8.0
                
                normal_hours = 0.0
                ot_1_5 = 0.0
                ot_2_0 = 0.0
                
                is_ot_eligible = employment.is_ot_eligible if employment else True
                
                if day_type == "rest_day" or day_type == "public_holiday":
                    ot_2_0 = actual_hours
                    steps.append(f"Rest Day/Public Holiday: {round(ot_2_0, 2)}h OT 2.0x")
                else:
                    normal_hours = min(actual_hours, scheduled_hours)
                    if is_ot_eligible:
                        ot_1_5 = max(0, actual_hours - scheduled_hours)
                    else:
                        normal_hours = actual_hours
                    steps.append(f"Payable: {round(normal_hours, 2)}h Normal" + (f", {round(ot_1_5, 2)}h OT 1.5x" if ot_1_5 > 0 else ""))
            
            # Add Shift-level Offered OT
            if shift and (float(shift.offered_ot_1_5x) > 0 or float(shift.offered_ot_2_0x) > 0):
                ot_1_5 += float(shift.offered_ot_1_5x)
                ot_2_0 += float(shift.offered_ot_2_0x)
                steps.append(f"Bonus Shift OT: {float(shift.offered_ot_1_5x)}h (1.5x), {float(shift.offered_ot_2_0x)}h (2.0x)")
            
            calculation_log = " | ".join(steps)

            # 6. Save/Update DailyAttendance
            daily_stmt = select(DailyAttendance).where(
                and_(
                    DailyAttendance.employment_id == record.employment_id,
                    DailyAttendance.work_date == work_date
                )
            )
            daily_result = await self.db.execute(daily_stmt)
            daily = daily_result.scalar_one_or_none()
            
            if not daily:
                daily = DailyAttendance(
                    employment_id=record.employment_id,
                    entity_id=entity_id,
                    work_date=work_date
                )
                self.db.add(daily)
            
            daily.actual_hours = actual_hours
            daily.calculation_log = calculation_log
            daily.scheduled_hours = scheduled_hours
            daily.normal_hours = normal_hours
            # Sum: Calculated + Shift-level Offered + Manual Adjustments
            daily.ot_hours_1_5x = ot_1_5 + float(daily.ot_adjustment_1_5x or 0)
            daily.ot_hours_2x = ot_2_0 + float(daily.ot_adjustment_2x or 0)
            daily.lateness_minutes = lateness
            daily.early_leave_minutes = early_leave
            daily.scheduled_shift_id = shift.id if shift else None
            
            if is_in_progress:
                daily.status = "in_progress"
            else:
                daily.status = "approved" if record.is_approved else "pending"
            
        await self.db.flush()

    async def compute_monthly_attendance(self, entity_id: uuid.UUID, period: date):
        """
        Automates processing for the entire month:
        1. Process each day (daily computation).
        2. Roll up totals into MonthlyOTSummary.
        """
        import calendar
        from app.models.attendance import MonthlyOTSummary
        from decimal import Decimal

        _, last_day = calendar.monthrange(period.year, period.month)
        start_date = period.replace(day=1)
        end_date = period.replace(day=last_day)

        # 1. Process Daily Attendance for each day in range
        current_date = start_date
        while current_date <= end_date:
            await self.compute_daily_attendance(entity_id, current_date)
            current_date += timedelta(days=1)
        
        await self.db.flush()

        # 2. Monthly Rollup into MonthlyOTSummary
        stmt = select(DailyAttendance).where(
            and_(
                DailyAttendance.entity_id == entity_id,
                DailyAttendance.work_date >= start_date,
                DailyAttendance.work_date <= end_date
            )
        )
        daily_records = (await self.db.execute(stmt)).scalars().all()

        # Aggregate per employee
        aggregates = {} # employment_id -> {normal, ot15, ot20}
        for rec in daily_records:
            emp_id = rec.employment_id
            if emp_id not in aggregates:
                aggregates[emp_id] = {
                    "normal": Decimal("0"),
                    "ot15": Decimal("0"),
                    "ot20": Decimal("0")
                }
            aggregates[emp_id]["normal"] += Decimal(str(rec.normal_hours))
            aggregates[emp_id]["ot15"] += Decimal(str(rec.ot_hours_1_5x))
            aggregates[emp_id]["ot20"] += Decimal(str(rec.ot_hours_2x))

        for emp_id, totals in aggregates.items():
            sum_stmt = select(MonthlyOTSummary).where(
                and_(
                    MonthlyOTSummary.employment_id == emp_id,
                    MonthlyOTSummary.period == start_date
                )
            )
            summary = (await self.db.execute(sum_stmt)).scalar_one_or_none()

            if not summary:
                summary = MonthlyOTSummary(
                    employment_id=emp_id,
                    entity_id=entity_id,
                    period=start_date
                )
                self.db.add(summary)

            summary.total_normal_hours = float(totals["normal"])
            summary.ot_hours_1_5x = float(totals["ot15"])
            summary.ot_hours_2x = float(totals["ot20"])
            summary.total_ot_hours = float(totals["ot15"] + totals["ot20"])
        
        await self.db.flush()

    # ─── Public Holiday Methods ───

    SG_HOLIDAYS = {
        2026: [
            ("New Year's Day", date(2026, 1, 1), None),
            ("Chinese New Year", date(2026, 2, 17), None),
            ("Chinese New Year", date(2026, 2, 18), None),
            ("Hari Raya Puasa", date(2026, 3, 21), None),
            ("Good Friday", date(2026, 4, 3), None),
            ("Labour Day", date(2026, 5, 1), None),
            ("Hari Raya Haji", date(2026, 5, 27), None),
            ("Vesak Day", date(2026, 5, 31), date(2026, 6, 1)),  # Sun → Mon observed
            ("National Day", date(2026, 8, 9), date(2026, 8, 10)),  # Sun → Mon observed
            ("Deepavali", date(2026, 11, 8), date(2026, 11, 9)),  # Sun → Mon observed
            ("Christmas Day", date(2026, 12, 25), None),
        ],
        2025: [
            ("New Year's Day", date(2025, 1, 1), None),
            ("Chinese New Year", date(2025, 1, 29), None),
            ("Chinese New Year", date(2025, 1, 30), None),
            ("Hari Raya Puasa", date(2025, 3, 31), None),
            ("Good Friday", date(2025, 4, 18), None),
            ("Labour Day", date(2025, 5, 1), None),
            ("Vesak Day", date(2025, 5, 12), None),
            ("Hari Raya Haji", date(2025, 6, 7), None),
            ("National Day", date(2025, 8, 9), None),
            ("Deepavali", date(2025, 10, 20), None),
            ("Christmas Day", date(2025, 12, 25), None),
        ],
    }

    async def get_public_holidays(self, entity_id: uuid.UUID, year: int) -> List[PublicHoliday]:
        stmt = select(PublicHoliday).where(
            and_(PublicHoliday.entity_id == entity_id, PublicHoliday.year == year)
        ).order_by(PublicHoliday.holiday_date)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_public_holiday(self, data) -> PublicHoliday:
        ph = PublicHoliday(
            entity_id=data.entity_id,
            name=data.name,
            holiday_date=data.holiday_date,
            observed_date=data.observed_date,
            is_recurring=data.is_recurring,
            year=data.year
        )
        self.db.add(ph)
        await self.db.flush()
        await self.db.refresh(ph)
        return ph

    async def update_public_holiday(self, ph_id: uuid.UUID, data) -> Optional[PublicHoliday]:
        stmt = select(PublicHoliday).where(PublicHoliday.id == ph_id)
        result = await self.db.execute(stmt)
        ph = result.scalar_one_or_none()
        if not ph:
            return None
        for field in ["name", "holiday_date", "observed_date", "is_recurring"]:
            val = getattr(data, field, None)
            if val is not None:
                setattr(ph, field, val)
        await self.db.flush()
        await self.db.refresh(ph)
        return ph

    async def delete_public_holiday(self, ph_id: uuid.UUID) -> bool:
        stmt = select(PublicHoliday).where(PublicHoliday.id == ph_id)
        result = await self.db.execute(stmt)
        ph = result.scalar_one_or_none()
        if not ph:
            return False
        await self.db.delete(ph)
        await self.db.flush()
        return True

    async def seed_sg_holidays(self, entity_id: uuid.UUID, year: int) -> List[PublicHoliday]:
        """
        Populate all gazetted Singapore public holidays for a given year.
        Skips any that already exist for the entity+date.
        """
        holidays_data = self.SG_HOLIDAYS.get(year, [])
        if not holidays_data:
            return []

        created = []
        for name, hol_date, obs_date in holidays_data:
            # Use observed_date if set, otherwise use holiday_date for the actual PH date
            effective_date = obs_date if obs_date else hol_date
            # Check if already exists
            existing = await self.db.execute(
                select(PublicHoliday).where(
                    and_(PublicHoliday.entity_id == entity_id, PublicHoliday.holiday_date == effective_date)
                )
            )
            if existing.scalar_one_or_none():
                continue

            ph = PublicHoliday(
                entity_id=entity_id,
                name=name,
                holiday_date=effective_date,
                observed_date=obs_date,
                is_recurring=False,
                year=year
            )
            self.db.add(ph)
            created.append(ph)

        await self.db.flush()
        for ph in created:
            await self.db.refresh(ph)
        return created

    async def get_ph_dates_set(self, entity_id: uuid.UUID, start_date: date, end_date: date) -> set:
        """
        Returns a set of dates that are public holidays for the entity within the range.
        Uses holiday_date (or observed_date if set) for matching.
        """
        stmt = select(PublicHoliday).where(
            and_(
                PublicHoliday.entity_id == entity_id,
                PublicHoliday.holiday_date >= start_date,
                PublicHoliday.holiday_date <= end_date
            )
        )
        result = await self.db.execute(stmt)
        return {ph.holiday_date for ph in result.scalars().all()}
