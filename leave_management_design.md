# ezyHR — Leave Management Design Document
> Version 1.0 · 5 March 2026 · Based on MOM Employment Act (Singapore)

---

## Table of Contents
1. [Overview & Goals](#1-overview--goals)
2. [Leave Types Reference](#2-leave-types-reference)
3. [DB Schema — Full Design](#3-db-schema--full-design)
4. [MOM Statutory Rules (DB-Driven)](#4-mom-statutory-rules-db-driven)
5. [Shared Pool Mechanics](#5-shared-pool-mechanics)
6. [Leave Lifecycle](#6-leave-lifecycle)
7. [Carry Forward](#7-carry-forward)
8. [Engine Resolution Order](#8-engine-resolution-order)
9. [Worked Examples](#9-worked-examples)
10. [Current Implementation Status](#10-current-implementation-status)
11. [Phased Build Plan](#11-phased-build-plan)

---

## 1. Overview & Goals

### Design Principles
- **MOM-compliant by default** — all statutory rules seeded from DB, not hardcoded
- **Zero code deploy for rule changes** — new MOM amendment = `INSERT` a new rule row
- **Per-entity overrides** — company can be more generous than MOM minimum
- **Multi-entity person** — one person at 2 companies = 2 independent leave ledgers
- **Retroactive accuracy** — historical leaves always resolved against rules active *at that time*

### Key Relationships
```
Entity ──< LeaveType ──< LeaveEntitlement ──< LeaveRequest
                │
                └── LeavePool (shared cap between leave types)
                        └── StatutoryLeaveRule (step table JSON)
```

---

## 2. Leave Types Reference

### MOM EA — Statutory Leave Types

| Code | Name | Unit | Tenure-Based? | Pool |
|---|---|---|---|---|
| `ANNUAL` | Annual Leave | Days/yr | ✅ Years | None |
| `SICK` | Outpatient Sick Leave | Days/yr | ✅ Months | `SICK_POOL` (sub-cap) |
| `HOSPITALISATION` | Hospitalisation Leave | Days/yr | ✅ Months | `SICK_POOL` (shared) |
| `MATERNITY` | Maternity Leave | Weeks | ❌ Flat | None |
| `PATERNITY` | Govt-Paid Paternity Leave | Weeks | ❌ Birth-date | `SPL_POOL` |
| `SPL` | Shared Parental Leave | Weeks | ❌ Birth-date | `SPL_POOL` (family) |
| `CHILDCARE` | Childcare Leave | Days/yr | ❌ Child age | None |
| `NPL` | No-Pay Leave | Days | ❌ None | None |

### Common Company-Added Types
| Code | Name | Remarks |
|---|---|---|
| `COMPASSIONATE` | Compassionate Leave | e.g. 3 days on bereavement |
| `BIRTHDAY` | Birthday Leave | 1 paid day |
| `EXAM` | Study/Exam Leave | Usually unpaid |
| `MARRIAGE` | Marriage Leave | Company discretionary |

---

## 3. DB Schema — Full Design

### 3.1 Existing Tables (Current State)

```sql
-- Already exists
leave_types (
    id, entity_id, name, code,
    is_paid, is_statutory, is_active,
    description, created_at, updated_at
)

-- Already exists
leave_entitlements (
    id, employment_id, leave_type_id, year,
    total_days, used_days, pending_days,
    carried_over_days,  -- ← exists but unused
    created_at, updated_at
)

-- Already exists
leave_requests (
    id, employment_id, leave_type_id,
    start_date, end_date, days_count,
    status, reason, attachment_url,
    approved_by, approved_at,
    created_at, updated_at
)
```

### 3.2 New Tables (Option 2 — DB-Driven Rules)

#### `leave_pools` — Shared Leave Caps
```sql
CREATE TABLE leave_pools (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id       UUID REFERENCES entities(id) ON DELETE CASCADE,
    code            VARCHAR(20) NOT NULL,      -- 'SICK_POOL', 'SPL_POOL'
    name            VARCHAR(100) NOT NULL,     -- 'Sick & Hospitalisation Pool'
    cap_days        DECIMAL(5,1) NOT NULL,     -- 60.0
    scope           VARCHAR(20) NOT NULL,      -- 'employment' | 'family'
    effective_from  DATE NOT NULL,
    effective_to    DATE,                      -- NULL = currently active
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (entity_id, code, effective_from)
);

-- Add pool reference to leave_types
ALTER TABLE leave_types
    ADD COLUMN pool_id      UUID REFERENCES leave_pools(id),
    ADD COLUMN pool_sub_cap DECIMAL(5,1);     -- sub-cap within the pool (e.g. 14 for SICK)
```

#### `statutory_leave_rules` — MOM Step Tables
```sql
CREATE TABLE statutory_leave_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_type_code VARCHAR(20) NOT NULL,     -- 'ANNUAL', 'SICK', 'HOSPITALISATION'
    effective_from  DATE NOT NULL,
    effective_to    DATE,                     -- NULL = currently active
    tenure_unit     VARCHAR(10) NOT NULL,     -- 'months' | 'years'
    progression     JSONB NOT NULL,           -- step table (see §4)
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (leave_type_code, effective_from)
);
```

#### `leave_type_policies` — Company Overrides
```sql
CREATE TABLE leave_type_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id       UUID REFERENCES entities(id) ON DELETE CASCADE,
    leave_type_code VARCHAR(20) NOT NULL,
    override_days   DECIMAL(5,1),            -- e.g. 18.0 (company gives more than MOM's 14)
    effective_from  DATE NOT NULL,
    effective_to    DATE,
    notes           TEXT,
    UNIQUE (entity_id, leave_type_code, effective_from)
);
```

#### `leave_carry_policies` — Carry Forward Rules
```sql
CREATE TABLE leave_carry_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id       UUID REFERENCES entities(id) ON DELETE CASCADE,
    leave_type_code VARCHAR(20) NOT NULL,
    max_carry_days  DECIMAL(5,1) NOT NULL,   -- e.g. 5.0 (max days to roll over)
    expiry_month    INTEGER,                  -- 3 = March (carry forward expires Mar 31)
    expiry_day      INTEGER,                  -- 31
    effective_from  DATE NOT NULL,
    UNIQUE (entity_id, leave_type_code, effective_from)
);
```

#### `family_links` — For SPL Cross-Person Pool
```sql
CREATE TABLE family_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id   UUID NOT NULL,               -- shared UUID for both spouses
    person_id   UUID REFERENCES persons(id),
    role        VARCHAR(20),                 -- 'primary' | 'partner'
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (person_id)
);
```

### 3.3 ER Diagram

```
entities
  │
  ├──< leave_types ──────────── pool_id ──> leave_pools
  │       │                                      │
  │       │                              effective_from (history)
  │       │
  ├──< leave_type_policies (entity override for cap)
  ├──< leave_carry_policies (carry forward rules)
  └──< statutory_leave_rules (MOM step tables — global, not per entity)

employments
  │
  ├──< leave_entitlements ──── leave_type_id ──> leave_types
  │         │
  │         └── carried_over_days, total_days, used_days, pending_days
  │
  └──< leave_requests
            │
            ├── status: pending | approved | rejected | cancelled
            └── days_count (working days, PH/rest excluded)
```

---

## 4. MOM Statutory Rules (DB-Driven)

### 4.1 Seed Data — `statutory_leave_rules`

#### Annual Leave (AL) — Progression by Years
```json
// leave_type_code: 'ANNUAL', tenure_unit: 'years', effective_from: '2000-01-01'
[
  {"min_tenure": 0, "days": 7},
  {"min_tenure": 1, "days": 8},
  {"min_tenure": 2, "days": 9},
  {"min_tenure": 3, "days": 10},
  {"min_tenure": 4, "days": 11},
  {"min_tenure": 5, "days": 12},
  {"min_tenure": 6, "days": 13},
  {"min_tenure": 7, "days": 14}
]
```
> `min_tenure` = completed years of service (anniversary-based). Year 1 = 0 completed years → 7 days.

#### Sick Leave / Outpatient (ML) — Progression by Months
```json
// leave_type_code: 'SICK', tenure_unit: 'months', effective_from: '2000-01-01'
[
  {"min_tenure": 0, "days": 0},
  {"min_tenure": 3, "days": 5},
  {"min_tenure": 4, "days": 8},
  {"min_tenure": 5, "days": 11},
  {"min_tenure": 6, "days": 14}
]
```

#### Hospitalisation Leave (HL) — Pool sizes by Months
```json
// leave_type_code: 'HOSPITALISATION', tenure_unit: 'months', effective_from: '2000-01-01'
// 'days' = total POOL size (inclusive of SICK outpatient sub-cap)
[
  {"min_tenure": 0, "days": 0},
  {"min_tenure": 3, "days": 15},
  {"min_tenure": 4, "days": 30},
  {"min_tenure": 5, "days": 45},
  {"min_tenure": 6, "days": 60}
]
```

#### Government-Paid Paternity Leave (GPPL) — Birth-Date Cutoff
```json
// leave_type_code: 'PATERNITY', tenure_unit: 'months', effective_from: '2000-01-01'
// 3+ months service required, flat entitlement
[{"min_tenure": 3, "days": 14}]   // 2 weeks — for births BEFORE 1 Apr 2025

// A NEW ROW inserted when MOM changed the rule:
// effective_from: '2025-04-01'
[{"min_tenure": 3, "days": 28}]   // 4 weeks — for births ON/AFTER 1 Apr 2025
```
> The engine picks rule by `MAX(effective_from) WHERE effective_from <= child_birth_date`

#### Shared Parental Leave (SPL) Pool — Birth-Date Cutoff
```json
// Pool cap record in leave_pools, not statutory_leave_rules:
// Before Apr 2025: SPL_POOL.cap_days = 42  (6 weeks)
// From Apr 2025:   SPL_POOL.cap_days = 70  (10 weeks)
```

### 4.2 Step-Table Resolver (Engine Logic)

```python
def resolve_progression(self, rule_rows: list[dict], tenure: int) -> float:
    """
    Finds the last row where min_tenure <= current_tenure.
    Works for both 'months' (SICK/HL) and 'years' (AL).
    """
    applicable = [r for r in rule_rows if r["min_tenure"] <= tenure]
    return float(max(applicable, key=lambda r: r["min_tenure"])["days"]) if applicable else 0.0
```

---

## 5. Shared Pool Mechanics

### 5.1 SICK + HOSPITALISATION Pool (Same Employee)

```
leave_pools:  code='SICK_POOL', cap_days=60, scope='employment'
leave_types:
   SICK            → pool_id=SICK_POOL, pool_sub_cap=14
   HOSPITALISATION → pool_id=SICK_POOL, pool_sub_cap=NULL
```

**Check order when employee applies for HOSPITALISATION:**
```
1. Fetch SICK_POOL (cap=60)
2. Sum all SICK approved/pending days this year         = e.g. 10 days
3. Sum all HOSPITALISATION approved/pending days         = e.g. 20 days
4. pool_used = 10 + 20 = 30 days
5. days_requested = 5
6. pool_used + requested = 35 ≤ 60 → ALLOW ✅

If pool_used = 55 and days_requested = 10:
   55 + 10 = 65 > 60 → BLOCK ❌ "Pool cap of 60 days exceeded"
```

**Check order when employee applies for SICK:**
```
1. Check pool_sub_cap first: SICK used = 12, sub_cap = 14
   requesting 3 more → 12 + 3 = 15 > 14 → BLOCK ❌ "Outpatient sub-cap of 14 days exceeded"
   (even if pool has remaining capacity)
```

### 5.2 SPL Pool (Cross-Person / Family Scope)

```
leave_pools:  code='SPL_POOL', cap_days=70, scope='family'
family_links: person_A (family_id=F1) + person_B (family_id=F1)

Spouse A (father) applies 28 days PATERNITY:
  → pool_id = SPL_POOL, family_id = F1
  → sum all SPL/PATERNITY used across F1 = 0
  → 0 + 28 ≤ 70 → ALLOW ✅

Spouse B (mother) then applies 30 days SPL:
  → pool_id = SPL_POOL, family_id = F1
  → sum all SPL/PATERNITY used across F1 = 28 (A's days)
  → 28 + 30 = 58 ≤ 70 → ALLOW ✅

Spouse A then applies 20 more days SPL:
  → pool used = 58
  → 58 + 20 = 78 > 70 → BLOCK ❌ "Family SPL pool cap of 70 days exceeded"
```

---

## 6. Leave Lifecycle

### 6.1 Full State Machine
```
                  ┌─────────────┐
                  │  SUBMITTED  │
                  └──────┬──────┘
                         │ apply_leave()
                         ▼
                  ┌─────────────┐
         ┌────────│   PENDING   │────────┐
         │        └─────────────┘        │
         │ reject()                     approve()
         ▼                               ▼
  ┌──────────────┐               ┌──────────────┐
  │   REJECTED   │               │   APPROVED   │
  └──────────────┘               └──────┬───────┘
  (pending_days--)                      │ cancel()
                                        ▼
                                 ┌──────────────┐
                                 │  CANCELLED   │
                                 └──────────────┘
                                 (used_days--)
```

### 6.2 What Happens at Each Stage

| Transition | `pending_days` | `used_days` | `total_days` |
|---|---|---|---|
| Apply (pending) | **+N** | unchanged | unchanged |
| Approve | **-N** | **+N** | unchanged |
| Reject | **-N** | unchanged | unchanged |
| Cancel (after approve) | unchanged | **-N** | unchanged |

### 6.3 Balance Calculation
```
Available = total_days - used_days - pending_days
```

For statutory types without a static entitlement record:
```
total_days  = resolve_progression(rules, tenure) + carried_over_days
used_days   = SUM(leave_requests.days_count WHERE status='approved' AND year=Y)
pending_days = SUM(leave_requests.days_count WHERE status='pending' AND year=Y)
```

### 6.4 Working Days Counting

Leave days exclude:
1. **Public Holidays** — fetched from [public_holidays](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py#710-716) table for that entity's country
2. **Rest Day** — from `employments.rest_day` (e.g. Sunday=0)
3. **Default Sunday** — if `rest_day` not configured

```python
# Example: Apply 5 calendar days Mon–Fri where Wed is a PH
working_days = 0
for d in date_range(start, end):
    if d.weekday() not in [rest_day, SUNDAY]:
        if d not in public_holidays:
            working_days += 1
# Result: working_days = 4 (Wed excluded as PH)
```

---

## 7. Carry Forward

### 7.1 Policy Configuration (Per Entity)
```sql
-- Example: Acme Tech allows max 5 AL days to carry forward, expire Mar 31
INSERT INTO leave_carry_policies VALUES (
    entity_id='ACME', leave_type_code='ANNUAL',
    max_carry_days=5.0, expiry_month=3, expiry_day=31,
    effective_from='2024-01-01'
);
```

### 7.2 Jan 1 Celery Task Logic
```python
async def grant_new_year_entitlements(year: int):
    for employment in active_employments:
        for leave_type in entity.leave_types:

            # 1. Get previous year's balance
            prev = get_entitlement(employment, leave_type, year-1)
            unused = prev.total_days - prev.used_days - prev.pending_days
            unused = max(0, unused)

            # 2. Apply carry-forward policy
            carry_policy = get_carry_policy(entity, leave_type.code)
            carry = min(unused, carry_policy.max_carry_days) if carry_policy else 0

            # 3. Compute new year's statutory entitlement
            tenure_months = get_tenure_months(employment.join_date, date(year, 1, 1))
            statutory = resolve_progression(rules, tenure_months)

            # 4. Create new entitlement record
            create_entitlement(employment, leave_type, year,
                total_days = statutory + carry,
                carried_over_days = carry,
                used_days = 0,
                pending_days = 0
            )
```

### 7.3 Carry Forward with Expiry
```
Employee has 5 carried-forward AL days, expiry = Mar 31 2025.

Jan 15 2025: Available = 14 (new year) + 5 (carry) = 19 days
Mar 31 2025: carry expires
Apr 1  2025: Available = 14 (new year) − used = 14 days max
             (system zeroes out remaining carry_forward on Apr 1 job)
```

---

## 8. Engine Resolution Order

When computing entitlement for a leave application:

```
Step 1: Company Override?
  └── SELECT from leave_type_policies WHERE entity_id=X AND code=Y AND active
        ↓ found → use override_days as total cap
        ↓ not found →

Step 2: MOM Statutory Rule
  └── SELECT from statutory_leave_rules WHERE code=Y AND effective_from ≤ leave.start_date
      ORDER BY effective_from DESC LIMIT 1
      → resolve_progression(rule.progression, tenure_in_rule.tenure_unit)
        ↓

Step 3: Add Carry Forward
  └── total = statutory_days + carried_over_days (from entitlement record)
        ↓

Step 4: Pool Sub-Cap Check
  └── IF leave_type.pool_sub_cap IS NOT NULL:
        sub_used = SUM(requests WHERE type=THIS AND status IN approved/pending)
        IF sub_used + days > pool_sub_cap → BLOCK
        ↓

Step 5: Pool Cap Check
  └── IF leave_type.pool_id IS NOT NULL:
        IF pool.scope = 'employment':
          pool_used = SUM(all types in pool, this employee, this year)
        IF pool.scope = 'family':
          pool_used = SUM(all types in pool, all persons in family, this year)
        IF pool_used + days > pool.cap_days → BLOCK
        ↓

Step 6: Overall Balance Check
  └── available = total - used - pending
      IF days > available → BLOCK "Insufficient balance"
        ↓

Step 7: Create LeaveRequest (status=pending)
  └── pending_days += days
```

---

## 9. Worked Examples

### 9.1 Annual Leave — Fresh Graduate

> **Sarah** joins Acme Tech on **15 March 2025**.  
> Acme follows MOM minimum. No company override.  
> Sarah applies for 3 days AL from 10–12 Jun 2025.

```
Step 1: No company override for ANNUAL at Acme → skip
Step 2: MOM ANNUAL rule (effective 2000-01-01):
        join = 15 Mar 2025, leave_start = 10 Jun 2025
        tenure_months = get_tenure_months(Mar 15, Jun 10)
                      = (2025-2025)*12 + (6-3) = 3 months
                      (Jun 10 day 10 ≥ Mar 15 day 15? NO → 10 < 15 → 3-1 = 2 months)
        Wait — Jun has day 10, Mar has day 15. 10 < 15 → subtract 1 → 2 months
        tenure_years = 2 // 12 = 0
        progression lookup: min_tenure=0 → 7 days
Step 3: No carry forward (new employee)
Step 4: No pool
Step 5: No pool
Step 6: available = 7 - 0 - 0 = 7 days; requesting 3 → 3 ≤ 7 → ALLOW ✅
Result: 3 days approved. Balance = 4 days remaining.
```

---

### 9.2 Annual Leave — 7-Year Veteran

> **David** joined on **1 Jan 2018**.  
> Applying for 5 days AL from 5–9 May 2025.

```
tenure_months = (2025-2018)*12 + (5-1) = 84 + 4 = 88 months
               (May 5 day ≥ Jan 1 day → no subtract)
tenure_years  = 88 // 12 = 7

MOM progression: min_tenure=7 → 14 days  (year 8+)
available = 14 - 2 (already used) - 0 = 12 days
requesting 5 → 5 ≤ 12 → ALLOW ✅
```

---

### 9.3 Sick Leave Sub-Cap Blocks, But Pool Has Room

> **Priya** (6+ months service). Used 12 outpatient sick days already.  
> Applies for 3 more SICK days.

```
Step 1: No override
Step 2: MOM SICK at 6+ months = 14 days outpatient cap
Step 4: Pool sub-cap check: pool_sub_cap = 14
        sub_used = 12, requesting = 3 → 12+3 = 15 > 14
        → BLOCK ❌ "Outpatient sick leave sub-cap of 14 days exceeded."

(Even though SICK_POOL has 60 days total and only 12 used,
 the 14-day outpatient sub-cap kicks in first.)
```

---

### 9.4 Hospitalisation Uses Shared Pool

> Same **Priya**. Applied 12 SICK days (outpatient). Now hospitalised.  
> Applies 20 HOSPITALISATION days.

```
Step 4: HOSP has no pool_sub_cap (NULL) → skip
Step 5: Pool = SICK_POOL, cap=60, scope='employment'
        pool_used = SICK(12) + HOSP(0) = 12
        requesting = 20 → 12+20 = 32 ≤ 60 → ALLOW ✅

Later Priya recovers, tries another 30 HOSP days:
        pool_used = SICK(12) + HOSP(20) = 32
        requesting = 30 → 32+30 = 62 > 60
        → BLOCK ❌ "SICK_POOL cap of 60 days exceeded. Used: 32, Available: 28"
```

---

### 9.5 Carry Forward

> **Ben** had 14 AL days in 2024. Used 11. Carry policy = max 5 days.

```
Dec 31 2024 Celery task runs:
  unused = 14 - 11 = 3 days
  carry  = min(3, 5) = 3 days

Jan 1 2025 entitlement created:
  MOM AL for year 7 (Ben's tenure) = 13 days
  total_days = 13 + 3 = 16 days
  carried_over_days = 3

Jan 15 2025:
  Ben's balance = 16 - 0 - 0 = 16 days ✅

(If expiry_month=3, expiry_day=31 and Ben hasn't used the carry by Apr 1):
Apr 1 2025 expiry job:
  Deduct carry: total_days = 16 - 3 = 13, carried_over_days = 0
```

---

### 9.6 SPL Cross-Person Pool (Post Apr 2025 Birth)

> **Alex** (father) and **Jamie** (mother). Baby born **15 May 2025**.  
> family_id = UUID-F1. SPL_POOL after Apr 2025 = 70 days (10 weeks).

```
Alex applies 28 days PATERNITY (4 weeks post Apr 2025):
  pool.scope = 'family'
  family_pool_used = SUM across family F1 = 0
  0 + 28 = 28 ≤ 70 → ALLOW ✅

Jamie applies 28 days SPL (concurrent):
  family_pool_used = Alex (28) + Jamie (0) = 28
  28 + 28 = 56 ≤ 70 → ALLOW ✅

Alex applies 14 more days SPL:
  family_pool_used = Alex(28) + Jamie(28) = 56
  56 + 14 = 70 ≤ 70 → ALLOW ✅ (exactly at cap)

Jamie tries 5 more days SPL:
  family_pool_used = 70
  70 + 5 = 75 > 70 → BLOCK ❌ "Family SPL pool exhausted (70/70 days used)"
```

---

### 9.7 Employee at 2 Entities

> **Lin** works at **Acme Tech** (60% FTE) and **Beta Corp** (40% FTE).  
> Both entities use MOM minimum.

```
Acme Tech employment:
  LeaveEntitlement: employment_id=E1, year=2025, total=14 (yr8+), used=3
  Available at Acme = 11 days

Beta Corp employment:
  LeaveEntitlement: employment_id=E2, year=2025, total=14 (yr8+), used=0
  Available at Beta = 14 days

Lin applies 5 days AL at Acme:
  Check overlap: no conflict within Acme employment
  Cross-entity flag: Lin has no pending/approved overlap at Beta → clear
  5 ≤ 11 → ALLOW ✅

Lin simultaneously applies 5 days AL at Beta for SAME dates:
  Cross-entity conflict detected for dates 10–14 Jun 2025
  → WARNING "Leave conflict detected at Acme Tech for same period"
  (Warning, not hard block — HR can override)
```

---

## 10. Current Implementation Status

| Feature | Status | Notes |
|---|---|---|
| Leave types CRUD (admin) | ✅ Done | Master Data → Leave Types tab |
| MOM AL staircase (7→14) | ✅ Fixed | Anniversary-based via [get_tenure_months](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#15-21) |
| SICK/HOSP 60-day pool | ✅ Correct | Hardcoded; works but not DB-driven |
| 14-day outpatient sub-cap | ✅ Correct | Hardcoded |
| Apply/Approve/Reject | ✅ Done | Full status machine |
| Public Holiday exclusion | ✅ Done | PH lookup working |
| Rest day exclusion | ✅ Done | Falls back to Sunday |
| Cross-entity conflict check | ✅ Done | Warning only |
| Searchable dropdowns | ✅ Done | Employee + leave type |
| Custom DatePicker | ✅ Done | Portal-based, no clipping |
| DB-driven `statutory_leave_rules` | ❌ Missing | Phase 1 |
| `leave_pools` table | ❌ Missing | Phase 1 |
| `leave_type_policies` overrides | ❌ Missing | Phase 1 |
| `leave_carry_policies` | ❌ Missing | Phase 2 |
| Jan 1 Celery grant task | ❌ Missing | Phase 2 |
| Auto-grant on onboarding | ❌ Missing | Phase 2 |
| Carry forward computation | ❌ Missing | Phase 2 |
| GPPL birth-date cutoff | ❌ Missing | Phase 3 |
| SPL family pool | ❌ Missing | Phase 3 |
| `family_links` table | ❌ Missing | Phase 3 |
| Childcare lifetime cap (42d/14d) | ❌ Missing | Phase 3 |
| Maternity leave (16 wks) | ❌ Missing | Phase 3 |
| Admin UI for rules tables | ❌ Missing | Phase 3 |

---

## 11. Phased Build Plan

### Phase 1 — DB-Driven Rules Foundation (Engine Refactor)
| Task | Description |
|---|---|
| Migration | Create `statutory_leave_rules`, `leave_pools`, `leave_type_policies` tables |
| Seed data | Insert current MOM AL/SICK/HOSP rules as JSON progression |
| Engine refactor | Replace all hardcoded `if code == 'SICK'` with DB-lookup + resolver |
| Admin API | CRUD endpoints for `statutory_leave_rules` and `leave_pools` |

### Phase 2 — Leave Lifecycle Completion
| Task | Description |
|---|---|
| `leave_carry_policies` table | Create table + seed default policy |
| Jan 1 Celery task | Grant new year entitlements + compute carry forward |
| Carry expiry job | Apr 1 (or configured) — zero out expired carry |
| Auto-grant on onboarding | Insert entitlement row when employment created |
| Employee leave dashboard | Employee sees own balance, history, pending |

### Phase 3 — Advanced Statutory Leaves
| Task | Description |
|---|---|
| GPPL/Paternity | Birth-date cutoff logic, 2wk vs 4wk |
| `family_links` table | Link spouses for SPL pool |
| SPL | Cross-person pool, 6wk vs 10wk based on birth date |
| Childcare | Child age check, per-child lifetime cap (42/14 days) |
| Maternity | 16 weeks, SC vs non-SC, employer vs govt-paid split |
| Admin UI | Settings page for managing rules and pools |

---

*Document prepared: 5 March 2026 · ezyHR Leave Engine v2 Design*
