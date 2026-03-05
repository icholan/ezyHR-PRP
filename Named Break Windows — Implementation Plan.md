# Named Break Windows — Implementation Plan

Replace the single `break_minutes` integer on shifts with **time-window-based breaks** (Lunch, Dinner, Breakfast, etc.). The system auto-deducts only breaks that overlap with the employee's actual work period.

## How It Works

```
Employee: clock_in 09:00 → clock_out next day 09:00

Break Windows on Shift:
  ☀️ Lunch     12:00–13:00  (unpaid)  → overlaps ✅ deduct 60m
  🌙 Dinner    18:00–19:00  (unpaid)  → overlaps ✅ deduct 60m
  ☕ Tea Break  22:00–22:15  (paid)    → overlaps ✅ but paid, no deduction
  🌅 Breakfast 07:00–08:00  (unpaid)  → overlaps ✅ deduct 60m

Total Deduction = 180 min (3h)
Actual Work = 24h - 3h = 21h
OT = 21h - 8h = 13h
```

## Data Model

### [NEW] `shift_breaks` table

| Column | Type | Description |
|---|---|---|
| [id](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/components/Layout/Sidebar.tsx#42-145) | UUID (PK) | Auto-generated |
| `shift_id` | UUID (FK → shifts) | Parent shift |
| `label` | String(50) | "Lunch", "Dinner", "Breakfast", "Tea Break" |
| `break_start` | Time | e.g. `12:00` |
| `break_end` | Time | e.g. `13:00` |
| `is_paid` | Boolean (default `False`) | If `True`, break is NOT deducted from hours |
| `sort_order` | Integer (default 0) | Controls display order in UI |

> [!IMPORTANT]
> The existing `break_minutes` field on [Shift](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/settings/ShiftSettings.tsx#12-28) will be **kept for backward compatibility** but will become a computed/display-only value (sum of unpaid breaks within the shift window).

### Relationship

```python
class Shift:
    breaks = relationship("ShiftBreak", back_populates="shift",
                          order_by="ShiftBreak.sort_order",
                          cascade="all, delete-orphan")

class ShiftBreak:
    shift = relationship("Shift", back_populates="breaks")
```

---

## Proposed Changes

### Backend

#### [NEW] `ShiftBreak` model in [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/attendance.py)
- Add `ShiftBreak` class with all columns listed above
- Add `breaks` relationship to existing [Shift](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/settings/ShiftSettings.tsx#12-28) model

#### [NEW] Alembic migration
- Create `shift_breaks` table
- No changes to existing [shifts](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py#62-66) table (keep `break_minutes` as-is)

#### [MODIFY] [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/attendance.py)
- Add `ShiftBreakCreate` schema: `label`, `break_start`, `break_end`, `is_paid`, `sort_order`
- Add `ShiftBreakRead` schema: includes [id](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/components/Layout/Sidebar.tsx#42-145) + all fields
- Update [ShiftRead](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/attendance.py#23-29) to include `breaks: List[ShiftBreakRead]`

#### [MODIFY] [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/attendance.py)
- `POST /attendance/shifts/{shift_id}/breaks` — Add a break window
- `PUT /attendance/shifts/{shift_id}/breaks` — Replace all breaks (bulk update)
- `DELETE /attendance/shifts/{shift_id}/breaks/{break_id}` — Remove a break

#### [MODIFY] [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py)
- Replace the flat deduction logic:
  ```python
  # OLD:
  break_seconds = shift.break_minutes * 60

  # NEW:
  total_break_seconds = 0
  for brk in shift.breaks:
      if brk.is_paid:
          continue  # Paid breaks don't reduce work hours
      # Convert break times to datetimes on the work_date
      brk_start_dt = datetime.combine(work_date, brk.break_start)
      brk_end_dt = datetime.combine(work_date, brk.break_end)
      # Handle overnight breaks (e.g., breakfast next day)
      if brk.break_start < shift.start_time:
          brk_start_dt += timedelta(days=1)
          brk_end_dt += timedelta(days=1)
      overlap = max(0, (min(clock_out, brk_end_dt) - max(clock_in, brk_start_dt)).total_seconds())
      total_break_seconds += overlap
  ```
- Fallback: If `shift.breaks` is empty, use `shift.break_minutes` for backward compatibility

### Frontend

#### [MODIFY] [ShiftSettings.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/settings/ShiftSettings.tsx)
- Add a **"Meal Breaks"** section in the shift modal with repeatable rows:
  ```
  ┌─────────────────────────────────────────────────────┐
  │ Meal Breaks                                    [+]  │
  │ ┌──────────┬────────┬────────┬──────┬─────────────┐ │
  │ │ Label    │ Start  │ End    │ Paid │             │ │
  │ ├──────────┼────────┼────────┼──────┼─────────────┤ │
  │ │ Lunch    │ 12:00  │ 13:00  │  ☐   │  🗑️ Remove │ │
  │ │ Dinner   │ 18:00  │ 19:00  │  ☐   │  🗑️ Remove │ │
  │ │ Breakfast│ 07:00  │ 08:00  │  ☐   │  🗑️ Remove │ │
  │ └──────────┴────────┴────────┴──────┴─────────────┘ │
  └─────────────────────────────────────────────────────┘
  ```
- Update shift cards to show break summary (e.g., "3 breaks • 180 min total")
- Save breaks alongside shift creation/update via bulk API

---

## Overlap Calculation — Edge Cases

| Scenario | Clock In → Out | Breaks Applied | Result |
|---|---|---|---|
| Normal day | 09:00→18:00 | Lunch only | 8h work |
| OT till midnight | 09:00→00:00 | Lunch + Dinner | 13h work |
| Full 24h | 09:00→09:00+1 | Lunch + Dinner + Breakfast | 21h work |
| Early leave mid-lunch | 09:00→12:30 | 30m partial lunch | 3h work |
| Night shift | 22:00→06:00 | Supper (01:00–01:30) | 7.5h work |
| Paid tea break | 09:00→18:00 | Lunch (unpaid) + Tea (paid) | 8h work |

---

## Verification Plan

### Automated Test Script (`/tmp/verify_break_windows.py`)
1. **Scenario 1 — Normal 9-6**: Create shift with Lunch break → assert 8h work, 0h OT
2. **Scenario 2 — Extended to midnight**: Lunch + Dinner overlap → assert correct deduction
3. **Scenario 3 — Full 24h (9am → next 9am)**: All 3 meals → assert 21h work, 13h OT
4. **Scenario 4 — Partial overlap**: Clock out at 12:30 (mid-lunch) → assert 30m deducted
5. **Scenario 5 — Paid break**: Tea break with `is_paid=True` → assert NOT deducted
6. **Scenario 6 — Backward compat**: Shift with no breaks but `break_minutes=60` → assert 60m deducted
