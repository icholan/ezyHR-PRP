# HRMS V2 Leave Management Enhancements Walkthrough

This document summarizes the major feature upgrades and infrastructure improvements made to the ezyHR-PRP project, focusing on statutory compliance and reliable deployment.

## Features & Compliance

### 1. MOM Compliance Enforcement
We've implemented a strict validation layer that prevents administrative errors when adjusting or creating leave entitlements.

*   **Dynamic Rule Resolution**: The system now calculates the legal minimum entitlement for any employee based on their tenure and leave type.
*   **Automatic Rejection**: Any manual adjustment (via the "Adjust Entitlement" or "Add Entitlement" modals) that falls below the MOM statutory minimum is automatically rejected by the backend.
*   **User Feedback**: Clear compliance error messages are displayed in the UI to guide administrators (e.g., *"Compliance Error: The MOM/Company statutory minimum for Annual Leave is 11.0 days"*).

### 2. Administrative UI Upgrades
The `Leave Management` view has been revamped for clarity and consistency.

*   **Grouped Entitlements**: Entitlements are now grouped by employee name, making it easier to manage several leave types for the same person at once.
*   **Standalone Route**: The administrative management interface is now hosted on its own dedicated route (`/leave/team`).
*   **Contextual Modals**: "Add Entitlement" and "Adjust Entitlement" modals now include error containers and automatic state resets.

### 3. Family Leave enhancements
*   **Child Order Integration**: The Maternity Leave application form now includes a mandatory "Child Order" field to comply with Singapore's birth-rate weighted entitlements.

---

## Infrastructure & Deployment

### 1. Cloud-Ready Configuration (Railway.app)
The project has been fully optimized for zero-config deployment on Railway.

*   **Monorepo Support**: A root-level `railway.json` file explicitly configures the `backend/` as the service directory, resolving common build-context errors.
*   **Docker Integration**: The custom `Dockerfile` handles automated migrations and environment-specific port assignment.
*   **Database Scheme Injection**: The system dynamically prepends the `+asyncpg` driver to the `DATABASE_URL` provided by Railway, ensuring a plug-and-play experience.

### 2. Environment Parity
We've bridged the gap between local development and production.

*   **Full Dotenv Support**: The backend now prioritizes `.env` files for local development, matching the behavior of cloud service variables.
*   **Decoupled Database**: The `docker-compose.yml` is now "External DB First," allowing you to point your local environment to any PostgreSQL instance without relying on inside-container databases.

---

## How to Deploy (Quick Steps)

1.  **Push to GitHub**: All latest fixes are already pushed to `main`.
2.  **Connect Railway**: Choose the `ezyHR-PRP` repository.
3.  **Set Variables**: Ensure `DATABASE_URL` (external) and `JWT_SECRET` are set in the service settings.
4.  **Verification**: Railway will build the container from `backend/Dockerfile` and automatically run `alembic upgrade head` on startup.

### Final Verification Results
![Admin UI Overview](file:///Users/cholan/.gemini/antigravity/brain/49ae902c-4ba7-4d14-898f-7e589f14ecda/team_leave_page_1772694319396.png)
*Entitlement Management with Grouped View and Compliance Guardrails.*
