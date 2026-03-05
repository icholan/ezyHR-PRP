# Enhancing Custom Role Creation UI/UX

I have successfully overhauled the Custom Role Management interface, transforming it from a basic form into a premium, animated, and highly functional "Role Builder" experience.

## Key Enhancements

### 🛡️ Premium Role Architecture
- **Refined Role Cards**: Redesigned with a modern "Card-in-Card" aesthetic, featuring `Shield` icons, subtle shadows, and a clear visual hierarchy.
- **Dynamic Capability Tags**: Role cards now display a preview of assigned permissions with a "+N more" overflow indicator for high-permission roles.
- **Fluent Animations**: Integrated `framer-motion` for smooth layout transitions, modal entries, and list interactions.
- **Implemented Password Reset**: Added a "Key" icon to the User Management table that resets passwords to `Pass@123` with a confirmation modal and success toasts.
- **Fixed User Forms**: Repaired broken Tailwind CSS classes in the Add/Edit User modal (e.g., Tenants Admin slider and Entities scope are now visible).
- **Improved UX**: Redesign Master Data pages and simplified search/filter interactions.
- **Singapore OT Compliance**: Implemented Shift and Roster management with automated OT 1.5x and 2.0x calculations.

## Changes Made

### ⏰ Attendance & OT Calculations
- **Shift Management UI**: Created a premium, glassmorphic shift management interface with:
    - **Real-time Search**: Quick filtering of shift templates.
    - **Creation Wizard**: Simple modal to define timers, breaks, and overnight settings.
    - **Dual Grace Periods**: Separate configurations for **Lateness** (clock-in) and **Early Exit** (clock-out) grace periods.
    - **Penalty Rounding Blocks**: Automated "rounding up" of penalty minutes to standard blocks (e.g., 15m or 30m intervals).
    - **Offered OT (Dual-Level)**: Shift-template and manual-adjustment OT grants for compensating employees within their regular shift.
    - **Dynamic List**: Interactive cards showing shift summaries at a glance.
- **Backend OT Engine**: Automated calculation of Normal hours, OT 1.5x, and OT 2.0x based on MOM regulations.
  - **Total OT** = Calculated (actual work) + Shift-level Offered + Manual Adjustment per record.
  - **Named Break Windows**: Time-window-based breaks (Lunch, Dinner, Breakfast) with overlap deduction, `is_paid` support, and backward compatibility.

![Shift Management UI Demo](/Users/cholan/.gemini/antigravity/brain/1411a7e6-b70d-4397-8e51-477572733fab/shift_management_ui_test_1772545030031.webp)

#### 🕒 Penalty & Rounding Control
The new shift modal allows for precise control over grace periods and rounding blocks, ensuring fair but standardized attendance calculations.

![Shift Rounding Blocks UI](/Users/cholan/.gemini/antigravity/brain/1411a7e6-b70d-4397-8e51-477572733fab/shift_rounding_blocks_final_1772550895137.png)

### 👥 User Management Enhancements
- **Search & Filtering**: Added real-time debounced search and status filtering to the User table.
- **Pagination**: Implemented server-side pagination (10/20/50 per page).
- **Focus Persistence**: Fixed a bug where the search box would lose focus during data fetching by replacing full-page loaders with inline indicators.
- **User Management Enhancements**:
    - **Search Bar**: Real-time debounced search by name or email with **focus persistence**.
    - **Status Filtering**: Quick toggles for All, Active, and Inactive users.
    - **Smart Pagination Control**: Navigation controls with configurable page sizes (10/20/50).
    - **Smoother Loading**: Replaced full-page loading with an inline spinner to prevent input focus loss.
- **Improved Login Feedback**: Trimmmed email inputs on login and fixed error handling so that "Account is suspended" is correctly displayed instead of a generic error.
- **Improved Security Logic**: Password reset now correctly hashes 'Pass@123' on the backend.
- **User Reactivation**: Restored access for `cho@ezy.sg` and `chola@ezy.sg`.
### 🛠️ Advanced Role Builder Modal
- **Search-Enabled Permissions**: Added a real-time search bar to filter across groups and specific capability labels.
- **Category Power-Actions**: Implemented "Select Category" (Select All) and "Relinquish All" buttons for each permission group (Employee Management, Payroll, etc.), significantly reducing clicks.
- **Active Counter**: A live badge tracks the total number of permissions selected in real-time.
- **Modern Check-States**: Switched from standard checkboxes to lush, full-width interactive tiles with Lucide icons and distinct "Active" states.

## Proof of Work

### Verification Flow
The following recording demonstrates the complete lifecycle:
1.  **Search**: Filtering for "Payroll" capabilities.
2.  **Category Select**: Batch-selecting all "Employee Management" permissions.
3.  **Creation**: Forge a new "QA Lead" role.
4.  **Edit/Delete**: Verifying the lifecycle of custom roles.

![Role Builder Demo](/Users/cholan/.gemini/antigravity/brain/1411a7e6-b70d-4397-8e51-477572733fab/role_management_verification_final_1772530092307.webp)

---

## Master Data UI/UX Overhaul
Completely modernized the Master Data management interface (Departments, Grades, Groups, Customers).

### Key Features
- **Pill-based Navigation**: Modern tab system with category-specific icons and animated active indicators.
- **Card Grid Layout**: Replaced dense tables with visually rich, easy-to-scan cards.
- **Advanced Customer Display**: Enhanced presentation of UEN, contact info, and addresses.
- **Optimized Modal**: Refined form layouts with smooth `framer-motion` entrance and exit animations.

### Verification Results
Verified the updated UI across all tabs. Confirmed that the "Premium" look and feel is consistent with the rest of the application.

````carousel
![Departments Card Layout](/Users/cholan/.gemini/antigravity/brain/1411a7e6-b70d-4397-8e51-477572733fab/master_data_departments_1772531341425.png)
<!-- slide -->
![Customers Detailed Cards](/Users/cholan/.gemini/antigravity/brain/1411a7e6-b70d-4397-8e51-477572733fab/master_data_customers_1772531352947.png)
````

### Visual Proof of Interaction
The following recording demonstrates the smooth tab transitions and responsive search functionality:
![Master Data Interaction](/Users/cholan/.gemini/antigravity/brain/1411a7e6-b70d-4397-8e51-477572733fab/master_data_final_state_1772531327986.webp)

## Authentication System (Fixed)

Resolved a critical `MissingGreenlet` error that prevented user login. The issue was caused by lazy loading of the `entity_access` relationship during response serialization.

### Changes Made
- Updated the [Token](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/auth.py#7-12) schema in [backend/app/schemas/auth.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/auth.py) to use [UserRead](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/users.py#42-52).
- Implemented eager loading using `selectinload` in the login endpoint in [backend/app/api/v1/auth.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/auth.py).

### Verification Result
Successfully validated the fix with a complete login flow. The system now correctly loads and serializes user permissions without errors.

![Dashboard Post-Login](/Users/cholan/.gemini/antigravity/brain/1411a7e6-b70d-4397-8e51-477572733fab/dashboard_success_1772532542067.png)

### Video Evidence
The following recording shows the successful login and redirection to the dashboard:
![Auth Login Verification](/Users/cholan/.gemini/antigravity/brain/1411a7e6-b70d-4397-8e51-477572733fab/auth_login_verification_1772532476665.webp)

## User Management Fixes

Implemented critical fixes for user registration and management:
- **Case-Insensitive Uniqueness**: Emails are now checked for uniqueness case-insensitively, preventing duplicate account creations with varied casing.
- **Async Safety**: Resolved `MissingGreenlet` errors in [create_user](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/users.py#84-139) and [update_user](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/users.py#141-196) by ensuring permissions are eagerly loaded before serialization.
- **Lush Error Handling**: Updated the frontend to clearly display validation errors from the server.

![Duplicate Email Feedback](/Users/cholan/.gemini/antigravity/brain/1411a7e6-b70d-4397-8e51-477572733fab/duplicate_email_error_1772534210638.png)

## Technical Summary
- **Icons**: Transitioned from `@heroicons/react` to `lucide-react` for a sharper, more varied icon set.
- **Animations**: Utilized `AnimatePresence` for exit animations and `layout` props for smooth list reordering.
- **State Management**: Optimized permission filtering and batch selection using `useMemo` for high performance.

---

## Named Break Windows

Replaced the flat `break_minutes` deduction with a precise, overlap-based break calculation system that handles multiple named breaks (Lunch, Dinner, Breakfast), overnight shifts, partial overlaps, and paid breaks.

### Data Model

New [ShiftBreak](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/attendance.py#28-39) model ([attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/attendance.py)):

| Field | Type | Purpose |
|---|---|---|
| `label` | String | Break name (e.g., "Lunch", "Dinner") |
| `break_start` | Time | Window start (e.g., 12:00) |
| `break_end` | Time | Window end (e.g., 13:00) |
| `is_paid` | Boolean | If `true`, break is NOT deducted from work hours |
| `sort_order` | Integer | Display ordering in UI |

### Overlap Deduction Logic

```mermaid
graph TB
    A[Clock In / Clock Out] --> B{Shift has<br/>Break Windows?}
    B -->|Yes| C[For each break]
    B -->|No| D[Fallback: flat break_minutes]
    C --> E{is_paid?}
    E -->|Yes| F[Skip - not deducted]
    E -->|No| G[Calculate overlap<br/>with work period]
    G --> H[overlap = max 0, min clock_out brk_end<br/>minus max clock_in brk_start]
    H --> I[Sum all unpaid overlaps]
    I --> J[actual_hours = elapsed - total_breaks]
```

Key features of the overlap logic in [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py):
- **Overnight handling**: Breaks with `start < shift.start_time` are shifted to next calendar day
- **Midnight-crossing**: Breaks where `end < start` get +1 day on end time
- **Partial overlaps**: Only the actual overlap portion is deducted (e.g., leave at 12:30 = only 30min lunch deducted)
- **Backward compatible**: No breaks defined → falls back to `shift.break_minutes` flat deduction

### Verification Results — All 6 Scenarios Passed ✅

| # | Scenario | Clock In → Out | Breaks Applied | Actual Work |
|---|---|---|---|---|
| 1 | Normal Day | 9:00→18:00 | Lunch 60m | **8.0h** ✅ |
| 2 | Extended to Midnight | 9:00→00:00 | Lunch + Dinner 120m | **13.0h** ✅ |
| 3 | Full 24h | 9:00→next 9:00 | Lunch + Dinner + Breakfast 180m | **21.0h** ✅ |
| 4 | Partial (mid-lunch) | 9:00→12:30 | 30m partial overlap | **3.0h** ✅ |
| 5 | Paid Tea Break | 9:00→18:00 | Lunch (unpaid) + Tea (paid, NOT deducted) | **8.0h** ✅ |
| 6 | Backward Compat | 9:00→18:00 | No windows, flat 60m | **8.0h** ✅ |

### Frontend — Break Windows in Shift Modal

Updated [ShiftSettings.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/settings/ShiftSettings.tsx) with:
- **Repeatable break rows** — Add/Remove with Label, Start/End time pickers, Paid toggle
- **Card display** — Shows break count, total unpaid minutes, and individual break details
- **Scrollable modal** — Widened to `max-w-2xl` with `overflow-y-auto` for many breaks
- **Bulk PUT** — All breaks saved as a batch via `PUT /shifts/{id}/breaks`

### API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `PUT` | `/shifts/{id}/breaks` | Replace all breaks for a shift |
| `GET` | `/shifts/{id}/breaks` | List breaks for a shift |
| `DELETE` | `/shifts/{id}/breaks/{bid}` | Delete individual break |

### Files Changed

| File | Change |
|---|---|
| [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/attendance.py) | Added [ShiftBreak](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/attendance.py#28-39) model + `Shift.breaks` relationship |
| [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/attendance.py) | Added [ShiftBreakCreate](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/attendance.py#28-30), [ShiftBreakRead](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/attendance.py#31-37), [breaks](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/attendance.py#193-201) on [ShiftRead](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/attendance.py#41-48) |
| [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py) | Break CRUD + overlap logic in [compute_daily_attendance](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py#143-270) |
| [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/attendance.py) | 3 break endpoints |
| [ShiftSettings.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/settings/ShiftSettings.tsx) | Break rows UI + card display |
| Migration `cfdbccce6af0` | Created [shift_breaks](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py#95-99) table |

---

## Roster Management

Built a complete shift roster management system with a calendar grid UI, smart auto-generation using employee-level rest day data, and inline cell editing.

### Architecture

```mermaid
graph LR
    A[HR selects<br/>Week + Shift + Employees] --> B[POST /roster/generate]
    B --> C{For each Employee × Date}
    C --> D{weekday == rest_day?}
    D -->|Yes| E[day_type = rest_day<br/>no shift]
    D -->|No| F{5-day week<br/>& Saturday?}
    F -->|Yes| G[day_type = off_day<br/>no shift]
    F -->|No| H[day_type = normal<br/>assign shift]
    E & G & H --> I[Calendar Grid Display]
    I --> J[Click cell to edit]
    J --> K[PATCH /roster/id]
```

### Smart Auto-Generation

The key innovation: uses existing [Employment](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/models/employment.py#81-115) fields to eliminate manual work:

| Employment Field | How It's Used |
|---|---|
| `rest_day` (e.g., "Sunday") | Auto-marks that weekday as **Rest Day** — no shift |
| `working_days_per_week` (e.g., 5.0) | If ≤ 5, Saturday auto-marked as **Off Day** |

This means HR only clicks "Auto-Generate", picks a shift, and the system handles the rest.

### Backend — Service Methods

In [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py):

| Method | Purpose |
|---|---|
| [auto_generate_roster()](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py#182-241) | Smart generation with rest_day/working_days logic |
| [get_roster_enriched()](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py#264-305) | JOINed query returning employee name + shift name |
| [update_roster_cell()](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py#242-255) | Individual cell PATCH (auto-clears shift for RD/OFF/PH) |
| [delete_roster_cell()](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/attendance.py#280-292) | Remove single assignment |

### API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/attendance/roster` | Enriched list with names (JOINed) |
| `POST` | `/attendance/roster/generate` | Smart auto-generate |
| `POST` | `/attendance/roster/bulk` | Simple bulk assign |
| `PATCH` | `/attendance/roster/{id}` | Edit individual cell |
| `DELETE` | `/attendance/roster/{id}` | Remove individual cell |

### Frontend — Calendar Grid

Created [RosterManagement.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/attendance/RosterManagement.tsx):

| Feature | Implementation |
|---|---|
| **Calendar Grid** | Employee × 7-day table with sticky employee column |
| **Week Navigation** | ◀/▶ buttons shifting by 7 days |
| **Color Coding** | Blue=Shift, Red=RD, Gray=OFF, Orange=PH |
| **Click-to-Edit** | Dropdown picker for shift or day type |
| **Auto-Generate Modal** | Shift selector + employee checkboxes with Select All |
| **Legend Bar** | Color key for all shift abbreviations and day types |

### Files Changed

| File | Change |
|---|---|
| [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/attendance.py) | [RosterAutoGenerate](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/attendance.py#88-94), [RosterCellUpdate](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/attendance.py#95-98), [RosterReadEnriched](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/schemas/attendance.py#99-111) |
| [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/services/attendance.py) | 4 new service methods |
| [attendance.py](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/backend/app/api/v1/attendance.py) | 4 new endpoints |
| [RosterManagement.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/pages/attendance/RosterManagement.tsx) | **NEW** — Full calendar grid page |
| [App.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/App.tsx) | Route: `attendance/roster` |
| [Sidebar.tsx](file:///Users/cholan/MyProjects/ReactJS/mathi/ezyHR-PRP/frontend/src/components/Layout/Sidebar.tsx) | "Roster" nav link |

### Verification

Confirmed all 5 API endpoints registered via `curl` against the OpenAPI spec:
```
/api/v1/attendance/roster
/api/v1/attendance/roster/bulk
/api/v1/attendance/roster/generate
/api/v1/attendance/roster/{roster_id}
```
