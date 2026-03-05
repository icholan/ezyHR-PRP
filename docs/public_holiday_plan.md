# Public Holiday Management — Implementation Plan

## Background

Singapore's Employment Act mandates **11 paid public holidays** annually. The system must:
1. **Store** gazetted public holidays per entity (multi-tenant)
2. **Auto-mark** PH days in roster generation
3. **Calculate pay** correctly: work on PH = extra day's pay, OT on PH = **2.0x** multiplier
4. **Display** PH dates in the roster grid and provide a management UI

### Singapore 2026 Gazetted Public Holidays

| # | Holiday | Date | Day | Notes |
|---|---|---|---|---|
| 1 | New Year's Day | 1 Jan 2026 | Thu | |
| 2 | Chinese New Year | 17 Feb 2026 | Tue | |
| 3 | Chinese New Year | 18 Feb 2026 | Wed | |
| 4 | Hari Raya Puasa | 21 Mar 2026 | Sat | Subject to moon-sighting |
| 5 | Good Friday | 3 Apr 2026 | Fri | |
| 6 | Labour Day | 1 May 2026 | Fri | |
| 7 | Hari Raya Haji | 27 May 2026 | Wed | Subject to moon-sighting |
| 8 | Vesak Day | 31 May 2026 | Sun | **Observed Mon 1 Jun** |
| 9 | National Day | 9 Aug 2026 | Sun | **Observed Mon 10 Aug** |
| 10 | Deepavali | 8 Nov 2026 | Sun | **Observed Mon 9 Nov** |
| 11 | Christmas Day | 25 Dec 2026 | Fri | |

### MOM Pay Rules for PH

| Scenario | Pay |
|---|---|
| Employee does NOT work on PH | Paid as usual (gross rate for the day) |
| Employee WORKS on PH | Extra day's salary at basic rate + gross rate |
| OT on PH (beyond normal hours) | **2.0x** hourly basic rate (already in OT engine) |
| PH falls on Sunday | Next Monday is observed PH |
| PH falls on off-day (e.g., Sat for 5-day week) | Extra day pay OR day off-in-lieu |

---

## Proposed Changes

### Backend — Model

#### [NEW] PublicHoliday model in [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/attendance.py)

```python
class PublicHoliday(Base, IDMixin, TimestampMixin):
    __tablename__ = "public_holidays"
    
    entity_id = Column(UUID, ForeignKey("entities.id"), nullable=False)
    name = Column(String, nullable=False)           # "Chinese New Year"
    holiday_date = Column(Date, nullable=False)      # 2026-02-17
    observed_date = Column(Date, nullable=True)      # If PH falls on Sunday, store Mon here
    is_recurring = Column(Boolean, default=False)    # Fixed-date holidays (NYD, Xmas, etc.)
    year = Column(Integer, nullable=False)           # 2026
    
    __table_args__ = (
        UniqueConstraint("entity_id", "holiday_date", name="uq_entity_holiday_date"),
    )
```

> [!IMPORTANT]
> **Entity-scoped**: Each entity manages its own PH calendar. This supports multi-tenant setups where different entities may observe different holidays.

---

### Backend — Schemas

#### [MODIFY] [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/attendance.py)

```python
class PublicHolidayCreate(BaseModel):
    entity_id: uuid.UUID
    name: str
    holiday_date: date
    observed_date: Optional[date] = None
    is_recurring: bool = False
    year: int

class PublicHolidayRead(PublicHolidayCreate):
    id: uuid.UUID
    class Config:
        from_attributes = True

class PublicHolidayBulkSeed(BaseModel):
    entity_id: uuid.UUID
    year: int  # Seed all 11 SG holidays for this year
```

---

### Backend — Service Methods

#### [MODIFY] [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py)

| Method | Purpose |
|---|---|
| `get_public_holidays(entity_id, year)` | List all PHs for an entity/year |
| `create_public_holiday(data)` | Create single PH |
| `update_public_holiday(id, data)` | Update PH name/date |
| `delete_public_holiday(id)` | Delete single PH |
| `seed_sg_holidays(entity_id, year)` | Auto-populate all 11 SG 2026 holidays |
| `get_ph_dates_set(entity_id, start, end)` | Returns `Set[date]` for quick lookup |

#### Key Integration Points

**1. [auto_generate_roster](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py#182-241) — PH-Aware**
```python
# Before generating, fetch PH dates
ph_dates = await self.get_ph_dates_set(entity_id, start_date, end_date)

for each date:
    if roster_date in ph_dates:
        day_type = "public_holiday"
        shift_id = None  # or keep shift depending on policy
    elif weekday == rest_day_num:
        day_type = "rest_day"
        ...
```

**2. [compute_daily_attendance](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py#308-474) — PH Lookup**
```python
# Check if work_date is a PH for the entity
ph_check = await self.get_ph_dates_set(entity_id, work_date, work_date)
if work_date in ph_check:
    day_type = "public_holiday"  # Override roster day_type
```

---

### Backend — API Endpoints

#### [MODIFY] [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/attendance.py)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/attendance/public-holidays` | List PHs for entity + year |
| `POST` | `/attendance/public-holidays` | Create single PH |
| `POST` | `/attendance/public-holidays/seed` | Seed all 11 SG holidays for a year |
| `PATCH` | `/attendance/public-holidays/{id}` | Update PH |
| `DELETE` | `/attendance/public-holidays/{id}` | Delete PH |

---

### Database Migration

Create `public_holidays` table with:
- [id](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/components/Layout/Sidebar.tsx#43-146), `entity_id`, `name`, `holiday_date`, `observed_date`, `is_recurring`, `year`
- Unique constraint on [(entity_id, holiday_date)](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/App.tsx#25-68)

---

### Frontend

#### [NEW] Public Holiday Management in Settings

Add a "Public Holidays" tab/section in **Settings** or alongside **Shift Settings**:

- **Year selector** (dropdown: 2025, 2026, 2027)
- **"Seed SG 2026 Holidays" button** — one-click populate
- **Table** of holidays with name, date, observed date, edit/delete actions
- **Add Holiday form** — manual entry for custom holidays

#### [MODIFY] [RosterManagement.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/attendance/RosterManagement.tsx)

- **PH column highlight** — Orange background for PH dates (like today's blue highlight)
- **Auto-generate** now auto-marks PH dates (backend handles this)
- **Edit Cell modal** — PH option already exists ✅

---

## Verification Plan

### Automated Tests
1. Seed 2026 SG holidays → verify 11 entries created  
2. Auto-generate roster for a week containing a PH → verify PH cells auto-marked
3. [compute_daily_attendance](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py#308-474) on a PH date → verify `ot_2_0` applied
4. PH on Sunday → verify observed Monday stored correctly

### Manual Verification
1. Open Settings → Public Holidays → Seed 2026 → see all 11 holidays
2. Open Roster → generate for a week with Chinese New Year → see orange PH cells
3. Edit a cell to change from PH to Normal and back
