from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.platform import auth as platform_auth
from app.api.v1 import auth, payroll, reporting, employees, attendance, leave, users, entities, roles, masters
import os

app = FastAPI(
    title="Singapore HRMS SaaS API",
    description="V2 API with AI Audit, Multi-Entity Leave, and statutory Singapore compliance.",
    version="2.0.0"
)

# Configure CORS
origins = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    os.getenv("PLATFORM_ADMIN_URL", "http://localhost:3001"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Platform Admin Routes
from app.api.platform import admin as platform_admin
app.include_router(platform_auth.router, prefix="/platform")
app.include_router(platform_admin.router, prefix="/platform")

# Tenant Routes (V1)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(payroll.router, prefix="/api/v1")
app.include_router(reporting.router, prefix="/api/v1")
app.include_router(employees.router, prefix="/api/v1")
app.include_router(attendance.router, prefix="/api/v1")
app.include_router(leave.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(entities.router, prefix="/api/v1", tags=["Entities"])
app.include_router(roles.router, prefix="/api/v1", tags=["Roles & Permissions"])
app.include_router(masters.router, prefix="/api/v1/masters", tags=["Master Data"])

@app.get("/")
async def root():
    return {
        "message": "Singapore HRMS SaaS API is running",
        "version": "2.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    # TODO: Add DB and Redis health checks
    return {"status": "healthy"}
