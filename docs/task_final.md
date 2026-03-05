# Task Checklist

## Phase 1 — DB-Driven Leave Rule Architecture [DONE]
- [x] Implement `LeavePool` and `StatutoryLeaveRule` models
- [x] Migrations with MOM seed data (AL, SL, HL, PL)
- [x] Refactor `LeaveService` to resolve rules dynamically

## Phase 2 — Lifecycle & Automation [DONE]
- [x] Phase 2A: Onboarding Auto-Grant (Prorated seeding)
- [x] Phase 2B: Jan 1 Task & Carry-Forward (Annual grant + caps)
- [x] Phase 2C: Carry Expiry Job (Auto-zeroing after threshold)

## Phase 3 — Advanced Family & Statutory Logic [DONE]
- [x] GPPL birth-date logic (cutoff: 1 Apr 2025)
- [x] Shared Family Pools (SPL) across multiple employments
- [x] Lifetime Caps tracking (Childcare total limit)
- [x] Maternity Leave logic (112 days / 16 weeks)

## Phase 4 — Administrative UI & Maternity Expansion [DONE]
- [x] Entitlement Management API (Fetch/Update)
- [x] "Entitlements" Admin View in `LeaveManagement.tsx`
- [x] Balance Adjustment Modal (Total & Carry-over days)
- [x] Maternity "Child Order" Field in Apply Form
- [x] Resolved structural JSX syntax errors in `LeaveManagement.tsx`

## Infrastructure & Final Verification [DONE]
- [x] Debug 401 Unauthorized via trailing slash fix
- [x] Verify UI with browser recorder and screenshots
- [x] Update documentation with final compliance walkthrough

## UI Navigation Refactoring [DONE]
- [x] Split `LeaveManagement.tsx` logic into separate routes
- [x] Update `App.tsx` with `/leave/my` and `/leave/team`
- [x] Update `Sidebar.tsx` with separate "My Leave" and "Team Leave" items
- [x] Verify separate page rendering and data fetching

## Manual Entitlement Creation [DONE]
- [x] Add `LeaveEntitlementCreate` schema
- [x] Add `create_entitlement` to `LeaveService`
- [x] Add `POST /entitlements` API endpoint
- [x] Add "Add Entitlement" UI (Button, Modal, Handler)
- [x] Verify manual creation works

## MOM Compliance Enforcement [DONE]
- [x] Create backend validation for `update_entitlement`
- [x] Create backend validation for `create_entitlement`
- [x] Fix UI to display compliance error messages
- [x] Verify enforcement with test scripts

## Git Repository Setup [DONE]
- [x] Create project-wide `.gitignore`
- [x] Initialize Git and link to remote
- [x] Commit all features and documentation
- [x] Push to `https://github.com/icholan/ezyHR-PRP.git`

## Railway Deployment Preparation [DONE]
- [x] Implement database connection scheme fix for `asyncpg`
- [x] Update Alembic `env.py` for environment-based database URLs
- [x] Create `start.sh` for automated migrations on deployment
- [x] Guide user through Railway dashboard configuration

## Finalize Documentation [DONE]
- [x] Update `walkthrough.md` with deployment details
- [x] Finalize `task.md`

## Environment Parity (Local & Railway) [DONE]
- [x] Add `python-dotenv` support to backend
- [x] Update `database.py` and `env.py` to auto-load `.env`
- [x] Create `.env.example` templates for frontend/backend
- [x] Commit and push environment parity changes

## Railway Deployment Troubleshooting [DONE]
- [x] Standardize Dockerfile location to `backend/Dockerfile`
- [x] Implement root-context strategy to fix missing `requirements.txt`
- [x] Configure `railway.json` for monorepo support (builder: `DOCKERFILE`, context: `.`)
- [x] Commit and push final deployment fixes

## External Database Configuration [DONE]
- [x] Update `docker-compose.yml` to support `${DATABASE_URL}`
- [x] Remove container-level DB dependencies from app services
- [x] Commit and push external DB support
