# Roster Management — Implementation Plan

Assign shifts to employees on a weekly/monthly calendar grid. Auto-populate rest days from Employment data, allow individual cell edits, and support bulk assignment.

## What Already Exists

| Component | Status |
|---|---|
| [ShiftRoster](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/attendance.py#40-50) model (employment_id, roster_date, shift_id, day_type) | ✅ |
| `GET /roster` + `POST /roster/bulk` APIs | ✅ |
| `Employment.rest_day` (e.g., "Sunday") | ✅ |
| `Employment.working_days_per_week` (e.g., 5.0, 6.0) | ✅ |
| Frontend Roster UI | ❌ Missing |
| Individual cell PATCH/DELETE | ❌ Missing |
| Smart auto-generation with rest days | ❌ Missing |

---

## Phase 1 — Core (This Sprint)

### Backend

#### [MODIFY] [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py)
- **`auto_generate_roster(entity_id, start_date, end_date, shift_id, employment_ids)`**
  - For each employee + date:
    - If `date.weekday_name == employment.rest_day` → `day_type = "rest_day"`
    - Else if `working_days_per_week == 5` and `date == Saturday` → `day_type = "off_day"`
    - Else → assign `shift_id`, `day_type = "normal"`
  - Clears existing roster in range before generating
- **`update_roster_cell(roster_id, shift_id, day_type)`** — single cell update
- **`delete_roster_cell(roster_id)`** — clear single assignment

#### [MODIFY] [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/attendance.py)
- `POST /attendance/roster/generate` — Smart auto-generate with rest day logic
- `PATCH /attendance/roster/{roster_id}` — Edit individual cell (change shift or day type)
- `DELETE /attendance/roster/{roster_id}` — Remove single assignment

#### [MODIFY] [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/attendance.py)
- `RosterAutoGenerate` schema: `entity_id`, `employment_ids[]`, `start_date`, `end_date`, `shift_id`
- `RosterCellUpdate` schema: `shift_id?`, `day_type?`
- Update [ShiftRosterRead](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/attendance.py#72-79) to include employee name (via joined response or separate lookup)

#### [MODIFY] [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/attendance.py) — Roster list enrichment
- `GET /roster` should return employee name + shift name alongside IDs for display
- Add `RosterReadEnriched` schema with `employee_name`, `shift_name`

### Frontend

#### [NEW] [RosterManagement.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/attendance/RosterManagement.tsx)

**Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│ 📅 Shift Roster          [◀ Prev Week] Mar 3-9, 2026 [Next ▶] │
│ [Department ▼] [Group ▼]                   [Auto-Generate 🔄] │
├───────────────┬──────┬──────┬──────┬──────┬──────┬──────┬─────┤
│ Employee      │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │ Sun │
│               │ 3/3  │ 3/4  │ 3/5  │ 3/6  │ 3/7  │ 3/8  │ 3/9│
├───────────────┼──────┼──────┼──────┼──────┼──────┼──────┼─────┤
│ Ahmad bin Ali │  AM  │  AM  │  AM  │  AM  │  AM  │ OFF  │ RD  │
│ Siti Nurhaliz │  PM  │  PM  │  PM  │  PM  │  PM  │ OFF  │ RD  │
│ Rajan Kumar   │  NT  │  NT  │  NT  │  NT  │  NT  │  NT  │ RD  │
└───────────────┴──────┴──────┴──────┴──────┴──────┴──────┴─────┘
```

**Interactions:**
- **Click cell** → Dropdown with available shifts + day types (Normal, Rest Day, Off Day, PH)
- **Auto-Generate** → Modal: pick shift, select employees → system fills the grid using `rest_day` logic
- **Color coding**: `AM`=Blue, `PM`=Green, `NT`=Purple, `RD`=Red, `OFF`=Gray, `PH`=Orange

#### [MODIFY] [App.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/App.tsx)
- Add route: `<Route path="attendance/roster" element={<RosterManagement />} />`

---

## Smart Auto-Generation Logic

```python
def auto_generate_roster(entity_id, start_date, end_date, shift_id, employment_ids):
    WEEKDAY_MAP = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6
    }

    for emp in employments:
        rest_day_num = WEEKDAY_MAP.get(emp.rest_day.lower()) if emp.rest_day else 6
        work_days = float(emp.working_days_per_week or 6)

        for each date in range:
            if date.weekday() == rest_day_num:
                → create roster(day_type="rest_day", shift_id=None)
            elif work_days <= 5 and date.weekday() == 5:  # Saturday for 5-day week
                → create roster(day_type="off_day", shift_id=None)
            else:
                → create roster(day_type="normal", shift_id=shift_id)
```

---

## Phase 2 — Enhancements (Future)

| Feature | Description |
|---|---|
| **Copy Week** | Copy current week's roster to next week |
| **Public Holidays** | Entity-level `public_holidays` table, auto-mark PH dates |
| **Monthly View** | Toggle between weekly and monthly calendar |
| **Export** | Export roster as Excel/PDF |

## Phase 3 — Advanced (Future)

| Feature | Description |
|---|---|
| **Shift Swap** | Employee requests to swap shift with colleague |
| **Notifications** | Alert employees when roster is published |
| **Conflict Detection** | Warn if employee already has leave on assigned date |

---

## Verification Plan

### Automated Tests
1. **Auto-generate** — Create roster for 5-day employee (rest_day=Sunday) → verify Mon-Fri=shift, Sat=off_day, Sun=rest_day
2. **Auto-generate 6-day** — 6-day employee → verify Mon-Sat=shift, Sun=rest_day
3. **Cell edit** — PATCH a roster cell to change shift → verify update
4. **Cell delete** — DELETE a roster cell → verify removal

### Manual Verification
5. **UI Test** — Open roster page, auto-generate for a week, click cells to edit, verify visual display
