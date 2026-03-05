# Phase 19: Entity-Level Master Data — Walkthrough

## Summary

Implemented full CRUD for entity-scoped master data: **Departments**, **Grades**, **Groups**, and **Customers**.

## Changes Made

### Backend ([masters.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/masters.py))
- CRUD endpoints for all 4 master types, each scoped to `entity_id`
- Permission-gated writes via [require_permission(Permission.MANAGE_ROLES)](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/dependencies.py#100-133)

### Backend ([main.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/main.py))
- Fixed **double-prefix routing** for entities (`/api/v1/entities/entities` → `/api/v1/entities`) and roles routers

### Backend ([schemas/masters.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/masters.py))
- Pydantic schemas for Create/Update/Read for all 4 types

### Backend ([models/employment.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/employment.py))
- New SQLAlchemy models: [Grade](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/employment.py#35-43), [Group](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/employment.py#44-52), [Customer](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/employment.py#53-65)
- Updated [Department](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/employment.py#25-34) with `code`, `description`, `is_active` fields

### Frontend ([MasterDataSettings.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/settings/MasterDataSettings.tsx))
- Tabbed UI for Departments/Grades/Groups/Customers
- Dynamic modal form (Customer fields appear only on Customer tab)
- Fixed API paths to use `/api/v1/masters/` prefix
- `entity_id` sent as both query param and body field

### Frontend routing & navigation
- [App.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/App.tsx): Route `/settings/master`
- [Sidebar.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/components/Layout/Sidebar.tsx): "Master Data" nav item

## Bugs Fixed
| Bug | Root Cause | Fix |
|-----|-----------|-----|
| 404 on `/api/v1/entities` | Double prefix in [main.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/main.py) | Changed to `prefix="/api/v1"` |
| 422 on POST masters | [require_permission](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/dependencies.py#100-133) expects `entity_id` as query param | Added `?entity_id=` to POST URL |
| 500 on POST masters | [require_permission](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/dependencies.py#100-133) returns `True`, not [User](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/store/useAuthStore.ts#4-13) | Renamed to `_has_permission`, removed redundant [get_entity_access](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/dependencies.py#69-99) |
| `ImportError: seed` | Orphan import in [main.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/main.py) | Removed [seed](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/scripts/seed_dev_data.py#25-430) from imports |

## Verification

### API Test (curl)
```
POST /api/v1/masters/departments?entity_id=... → 200 OK ✅
```

### Browser Test
- Login as `hrmanager@acme.com` → Dashboard loads ✅
- Entity Switcher shows "Singapore HQ" ✅
- Master Data → Departments tab shows "Engineering" ✅
- Customers → Add "Google Asia" → Created successfully ✅

![Customer created successfully](file:///Users/cholan/.gemini/antigravity/brain/f0863b95-2c4a-4270-9ed4-5a876b46860b/customer_created_success_1772473732633.png)

![Browser recording](file:///Users/cholan/.gemini/antigravity/brain/f0863b95-2c4a-4270-9ed4-5a876b46860b/master_data_final_1772473634057.webp)
