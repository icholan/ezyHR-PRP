import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.cors import CORSMiddleware
from app.api.platform import auth as platform_auth
from app.api.v1 import auth, profile, payroll, reporting, employees, attendance, leave, users, entities, roles, masters, ket, audit, dashboard, claims
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
from app.api.platform import statutory as platform_statutory
app.include_router(platform_auth.router, prefix="/platform")
app.include_router(platform_admin.router, prefix="/platform")
app.include_router(platform_statutory.router, prefix="/platform")

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
app.include_router(ket.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(claims.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    # TODO: Add DB and Redis health checks
    return {"status": "healthy"}

# Mount uploads directory
uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

# Serve Frontend Static Files
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")

if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"])
    async def serve_frontend(request: Request, full_path: str):
        # Prevent catching API routes
        if full_path.startswith("api/") or full_path.startswith("platform/"):
            raise HTTPException(status_code=404, detail="Not Found")
            
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        # Fallback for React Router (Single Page Application)
        index_path = os.path.join(frontend_dist, "index.html")
        if os.path.isfile(index_path):
            return FileResponse(index_path)
        
        raise HTTPException(status_code=404, detail="Not Found")
else:
    @app.get("/")
    async def root():
        return {
            "message": "Singapore HRMS SaaS API is running (Frontend not built)",
            "version": "2.0.0",
            "docs": "/docs"
        }

@app.get("/health")
async def health_check():
    # TODO: Add DB and Redis health checks
    return {"status": "healthy"}
