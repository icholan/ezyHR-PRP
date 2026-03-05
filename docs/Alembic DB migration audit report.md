# Alembic DB Migration Setup — Audit Report

## Files Created

| File | Purpose |
|------|---------|
| [alembic.ini](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/alembic.ini) | Config — sync `psycopg2` driver, points to `localhost:5432/postgres` |
| [env.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/alembic/env.py) | Imports all app models via `app.models.*` for autogenerate |
| [script.py.mako](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/alembic/script.py.mako) | Mako template for migration scripts |

## Migration Chain

```
<base> → 0001 → cfeca44774b9 (head)
```

| Rev | Description | Tables Affected |
|-----|-------------|-----------------|
| `0001` | Add `mobile_number`, `whatsapp_number`, `language` to persons | `persons` |
| `cfeca44774b9` | Fix `departments.is_active` nullable → NOT NULL | [departments](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/masters.py#30-39) |

## Verification Tests

| Test | Result |
|------|--------|
| `alembic current` | ✅ `cfeca44774b9 (head)` |
| `alembic history` | ✅ Clean chain, no orphans |
| `alembic heads` | ✅ Single head, no branches |
| `alembic check` (autogenerate dry-run) | ✅ **"No new upgrade operations detected"** (exit 0) |
| Downgrade → base | ✅ All 3 columns removed |
| Re-upgrade → head | ✅ All 3 columns restored |
| DB column types/lengths match model | ✅ `varchar(20)`, `varchar(20)`, `varchar(50)` |

## Quick Reference

```bash
cd backend && source ../.venv/bin/activate

# Check current migration state
alembic current

# Generate migration from model changes
alembic revision --autogenerate -m "description"

# Apply all pending migrations
alembic upgrade head

# Check if DB is in sync with models (CI-friendly)
alembic check

# Rollback last migration
alembic downgrade -1
```
