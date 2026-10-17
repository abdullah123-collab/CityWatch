"""
CityWatch Python Web Application — Main Entry Point

FastAPI application serving Jinja2 server-rendered HTML and REST endpoints for:
  /          → Citizen Portal (landing, login, register, dashboard, complaints)
  /staff/    → Staff Portal
  /admin/    → Admin Portal
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.templates import templates

# ── Routers ────────────────────────────────────────────────────────────────────
from app.routers import citizen, staff, admin

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Application ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CityWatch",
    description="Municipal Civic Grievance Management System — Python/Jinja2 frontend",
    version="2.0.0",
    docs_url="/api-docs" if settings.debug else None,
    redoc_url=None,
)

# ── Static files ───────────────────────────────────────────────────────────────
_static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")

# ── Uploads (serve existing Express uploads directory) ─────────────────────────
_uploads_dir = settings.upload_path
if _uploads_dir.exists():
    app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")
    logger.info("Serving uploads from %s", _uploads_dir)
else:
    logger.warning("Uploads directory not found at %s; /uploads/ won't be served.", _uploads_dir)

# ── Include Routers ────────────────────────────────────────────────────────────
app.include_router(citizen.router)
app.include_router(staff.router, prefix="/staff")
app.include_router(admin.router, prefix="/admin")


# ── Health endpoints ───────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
@app.get("/api/health", tags=["system"])
def health():
    from datetime import datetime, timezone
    return {
        "status": "ok",
        "service": "CityWatch Python Web Application",
        "time": datetime.now(timezone.utc).isoformat(),
        "database": "enabled" if settings.db_enabled else "disabled_pending_approval",
        "environment": settings.environment,
    }


# ── Convenience API endpoints ──────────────────────────────────────────────────
@app.get("/api/departments", tags=["system"])
def api_departments():
    from app.routers.citizen import _get_departments
    return {"departments": _get_departments()}



# ── Global error handlers ──────────────────────────────────────────────────────
@app.exception_handler(404)
async def not_found(request: Request, exc):
    return templates.TemplateResponse(
        "shared/error.html",
        {"request": request, "code": 404, "message": "Page not found."},
        status_code=404,
    )


@app.exception_handler(500)
async def server_error(request: Request, exc):
    logger.exception("Unhandled server error: %s", exc)
    return templates.TemplateResponse(
        "shared/error.html",
        {"request": request, "code": 500, "message": "An internal error occurred."},
        status_code=500,
    )
