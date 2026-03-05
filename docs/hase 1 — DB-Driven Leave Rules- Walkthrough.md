# Phase 1 — DB-Driven Leave Rules: Walkthrough
> Completed: 5 March 2026

## ✅ What Was Done

### 1. New DB Models ([backend/app/models/leave.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/leave.py))

| Model | Table | Purpose |
|---|---|---|
| [LeavePool](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/leave.py#13-32) | [leave_pools](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#669-688) | Shared cap between leave types (scope: `employment` or `family`) |
| [StatutoryLeaveRule](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/leave.py#34-55) | `statutory_leave_rules` | MOM EA step-tables as JSONB, with `effective_from/to` for history |
| [LeaveTypePolicy](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/leave.py#57-74) | [leave_type_policies](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/leave.py#338-351) | Per-entity company cap overrides |

[LeaveType](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/leave.py#80-98) model gained: `pool_id`, `pool_sub_cap`, `is_active`

---

### 2. Alembic Migration ([alembic/versions/0010_phase1_leave_rules.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/alembic/versions/0010_phase1_leave_rules.py))

**Ran successfully:** `alembic upgrade 0010_phase1_leave_rules`

Creates 3 new tables + alters [leave_types](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/leave.py#151-163). Seeds MOM statutory rules:

| Code | Tenure Unit | Rule |
|---|---|---|
| `ANNUAL` | years | 7→8→9→10→11→12→13→14 days (yr 1–8+) |
| `SICK` | months | 0→5→8→11→14 days (months 0,3,4,5,6+) |
| `HOSPITALISATION` | months | 0→15→30→45→60 days (pool cap) |
| `PATERNITY` | months | 14 days (pre Apr 2025), 28 days (Apr 2025+) |

---

### 3. Leave Service Refactored ([backend/app/services/leave.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py))

**Old (hardcoded):**
```python
if l_type.code in ["SICK", "HOSPITALISATION"]:
    outpatient_limit, hospital_limit = self.get_statutory_sick_limits(tenure_months)
    if used_sick > 14: ...
```

**New (DB-driven):**
```python
# Rule lookup — picks MAX(effective_from) ≤ leave.start_date
rule = await self.get_statutory_rule(leave_type_code, as_of_date)
limit = self.resolve_progression(rule.progression, tenure)

# Pool check — generic, works for any pool
await self.check_pool_limits(l_type, employment_id, days, year)
```

Key new methods:
- [get_statutory_rule()](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#61-80) — date-effective rule lookup
- [resolve_progression()](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#46-56) — step-table resolver (months or years)
- [get_company_override()](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#103-127) — entity-level cap override
- [resolve_entitlement()](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#132-157) — full entitlement (override → statutory → carry)
- [check_pool_limits()](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#162-226) — sub-cap + pool cap (generic for any pool)
- [list_statutory_rules()](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/leave.py#223-238) / [list_leave_pools()](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/leave.py#669-688) — admin listing

---

### 4. Schemas Updated ([backend/app/schemas/leave.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/leave.py))

Added:
- [LeavePoolCreate](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/leave.py#135-143), [LeavePoolRead](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/leave.py#149-162), [LeavePoolUpdate](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/leave.py#144-148)
- [StatutoryLeaveRuleCreate](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/leave.py#168-175), [StatutoryLeaveRuleRead](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/leave.py#176-187)
- [LeaveTypePolicyCreate](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/leave.py#193-199), [LeaveTypePolicyRead](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/leave.py#200-211)
- Updated [LeaveBalanceRead](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/leave.py#116-129) with `carried_over_days`, `pool_code`, `leave_type_id`, `is_paid`

---

### 5. New API Endpoints ([backend/app/api/v1/leave.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/leave.py))

#### Statutory Rules (MOM amendments)
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/leave/rules/statutory` | List all rules (filter by `?leave_type_code=ANNUAL`) |
| POST | `/leave/rules/statutory` | Add new rule when MOM updates EA |
| DELETE | `/leave/rules/statutory/{id}` | Retire old rule (sets `effective_to=today`) |

#### Leave Pools
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/leave/pools?entity_id=X` | List entity's pools |
| POST | `/leave/pools?entity_id=X` | Create SICK_POOL, SPL_POOL etc. |
| PATCH | `/leave/pools/{id}?entity_id=X` | Update cap or end-date a pool |

#### Company Policies / Overrides
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/leave/policies?entity_id=X` | List entity overrides |
| POST | `/leave/policies?entity_id=X` | Add override (e.g. 18 days AL) |
| DELETE | `/leave/policies/{id}?entity_id=X` | Remove override → falls back to MOM |

---

### 6. Verification

```
✅ python3 -c "from app.models.leave import LeavePool, StatutoryLeaveRule, LeaveTypePolicy ..."
✅ python3 -c "from app.services.leave import LeaveService ..."
✅ python3 -c "from app.api.v1.leave import router ..."
✅ alembic upgrade 0010_phase1_leave_rules  →  SUCCESS
```

---

## 🔜 What's Next (Phase 2)

1. **Jan 1 Celery/APScheduler task** — auto-grant new year entitlements
2. **Carry-forward policy table** (`leave_carry_policies`)
3. **Carry expiry job** (e.g. Apr 1)
4. **Auto-grant on employee onboarding**

Then Phase 3: GPPL birth-date logic, SPL family pool, Childcare lifetime cap.
