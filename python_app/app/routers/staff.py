"""
Staff Portal Router

All routes require Staff or Admin role session.

Routes (mounted at /staff/):
  GET  /staff/              → Redirect to dashboard
  GET  /staff/login         → Staff login form
  POST /staff/login         → Process staff login
  POST /staff/logout        → Log out
  GET  /staff/dashboard     → Staff dashboard with workload and complaint list
  GET  /staff/complaints    → Filtered complaint list
  GET  /staff/complaints/{id}  → Complaint detail (shows citizen phone)
  POST /staff/complaints/{id}/status  → Update complaint status
  GET  /staff/profile       → Staff profile
"""
from __future__ import annotations

import logging
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Form, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from app.core.config import settings
from app.core.security import create_session_cookie, get_current_user
from app.core.templates import templates

logger = logging.getLogger(__name__)

router = APIRouter(tags=["staff"])


# ── Session helpers ────────────────────────────────────────────────────────────

def _set_session(response, user: dict) -> None:
    token = create_session_cookie(user)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_max_age_seconds,
        httponly=True,
        samesite="lax",
        secure=settings.environment == "production",
    )


def _require_staff(request: Request):
    """Return user dict or None if not authenticated as staff/admin."""
    user = get_current_user(request)
    if not user:
        return None
    if user.get("role_name") not in ("Staff", "Admin"):
        return None
    return user


# ── Root redirect ──────────────────────────────────────────────────────────────

@router.get("/", response_class=HTMLResponse)
async def staff_root(request: Request):
    user = _require_staff(request)
    if not user:
        return RedirectResponse("/staff/login", status_code=303)
    return RedirectResponse("/staff/dashboard", status_code=303)


# ── Login ──────────────────────────────────────────────────────────────────────

@router.get("/login", response_class=HTMLResponse)
async def staff_login_page(request: Request):
    user = get_current_user(request)
    if user and user.get("role_name") in ("Staff", "Admin"):
        return RedirectResponse("/staff/dashboard", status_code=303)

    # Load available departments
    departments = []
    if settings.db_enabled:
        try:
            from app.repositories import admin_repository as ar
            departments = ar.get_all_departments()
        except Exception as exc:
            logger.warning("Could not load departments from DB: %s", exc)

    # In offline/mock mode or if DB has no departments, load clearly labelled demo departments
    if not departments:
        from app.core.demo_accounts import get_demo_departments
        departments = get_demo_departments()

    return templates.TemplateResponse(
        "staff/login.html",
        {
            "request": request,
            "departments": departments,
            "error": request.query_params.get("error"),
            "db_enabled": settings.db_enabled,
        },
    )


@router.post("/login")
async def staff_login_submit(
    request: Request,
    dept_id: int = Form(...),
    identifier: str = Form(None),
    email: str = Form(None),
    password: str = Form(...),
):
    staff_id_or_email = (identifier or email or "").strip()
    if not staff_id_or_email or not password:
        return RedirectResponse(
            f"/staff/login?error={quote('Invalid credentials or department selection.')}",
            status_code=303,
        )

    if settings.db_enabled:
        try:
            from app.repositories import auth_repository as ar
            user = ar.login_staff(staff_id_or_email, password, dept_id=dept_id)
            if not user or user.get("role_name") not in ("Staff", "Admin"):
                return RedirectResponse(
                    f"/staff/login?error={quote('Invalid credentials or department selection.')}",
                    status_code=303,
                )
            response = RedirectResponse("/staff/dashboard", status_code=303)
            _set_session(response, user)
            return response
        except Exception as exc:
            logger.exception("Staff login DB error: %s", exc)
            return RedirectResponse(
                f"/staff/login?error={quote('An error occurred during authentication.')}",
                status_code=303,
            )
    else:
        # Offline / Demo mode
        if getattr(settings, "demo_mode", True):
            from app.core.demo_accounts import authenticate_demo_staff
            user = authenticate_demo_staff(staff_id_or_email, password, dept_id=dept_id)
            if not user or user.get("role_name") not in ("Staff", "Admin"):
                return RedirectResponse(
                    f"/staff/login?error={quote('Invalid credentials or department selection.')}",
                    status_code=303,
                )
            response = RedirectResponse("/staff/dashboard", status_code=303)
            _set_session(response, user)
            return response
        else:
            return RedirectResponse(
                f"/staff/login?error={quote('Database not yet connected and demo mode is disabled.')}",
                status_code=303,
            )



# ── Logout ─────────────────────────────────────────────────────────────────────

@router.post("/logout")
async def staff_logout(request: Request):
    response = RedirectResponse("/staff/login", status_code=303)
    response.delete_cookie(key=settings.session_cookie_name)
    return response

@router.get("/logout")
async def staff_logout_get(request: Request):
    response = RedirectResponse("/staff/login", status_code=303)
    response.delete_cookie(key=settings.session_cookie_name)
    return response


# ── Dashboard ──────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_class=HTMLResponse)
async def staff_dashboard(
    request: Request,
    search: str = "",
    status_filter: str = "All",
):
    user = _require_staff(request)
    if not user:
        return RedirectResponse("/staff/login", status_code=303)

    dashboard_data = None
    complaints = []
    db_error = None

    if settings.db_enabled:
        try:
            from app.repositories import admin_repository as ar
            from app.repositories import complaint_repository as cr
            dashboard_data = ar.get_staff_dashboard(user["staff_id"])
            complaints = cr.get_assigned_complaints(
                user["staff_id"],
                search=search or None,
                status=status_filter if status_filter != "All" else None,
            )
        except Exception as exc:
            logger.error("Staff dashboard error: %s", exc)
            db_error = str(exc)

    return templates.TemplateResponse(
        "staff/dashboard.html",
        {
            "request": request,
            "user": user,
            "dashboard": dashboard_data,
            "complaints": complaints,
            "filters": {"search": search, "status": status_filter},
            "db_enabled": settings.db_enabled,
            "db_error": db_error,
        },
    )


# ── Complaint List ─────────────────────────────────────────────────────────────

@router.get("/complaints", response_class=HTMLResponse)
async def staff_complaints(
    request: Request,
    search: str = "",
    status_filter: str = "All",
    priority: str = "All",
):
    user = _require_staff(request)
    if not user:
        return RedirectResponse("/staff/login", status_code=303)

    complaints = []
    db_error = None

    if settings.db_enabled:
        try:
            from app.repositories import complaint_repository as cr
            complaints = cr.get_assigned_complaints(
                user["staff_id"],
                search=search or None,
                status=status_filter if status_filter != "All" else None,
                priority=priority if priority != "All" else None,
            )
        except Exception as exc:
            logger.error("Staff complaints list error: %s", exc)
            db_error = str(exc)

    return templates.TemplateResponse(
        "staff/complaint_list.html",
        {
            "request": request,
            "user": user,
            "complaints": complaints,
            "filters": {"search": search, "status": status_filter, "priority": priority},
            "db_enabled": settings.db_enabled,
            "db_error": db_error,
        },
    )


# ── Complaint Detail ───────────────────────────────────────────────────────────

@router.get("/complaints/{complaint_id}", response_class=HTMLResponse)
async def staff_complaint_detail(request: Request, complaint_id: int):
    user = _require_staff(request)
    if not user:
        return RedirectResponse("/staff/login", status_code=303)

    if not settings.db_enabled:
        return templates.TemplateResponse(
            "staff/complaint_detail.html",
            {
                "request": request,
                "user": user,
                "complaint": None,
                "history": [],
                "attachments": [],
                "db_enabled": False,
                "error": "Database not yet connected.",
            },
        )

    try:
        from app.repositories import complaint_repository as cr
        data = cr.get_complaint_details(complaint_id, user)
    except PermissionError as exc:
        return RedirectResponse(
            f"/staff/dashboard?error={quote(str(exc))}", status_code=303
        )
    except ValueError as exc:
        return RedirectResponse(
            f"/staff/dashboard?error={quote(str(exc))}", status_code=303
        )
    except Exception as exc:
        logger.error("Staff complaint detail error: %s", exc)
        return RedirectResponse(
            f"/staff/dashboard?error={quote('Failed to load complaint detail.')}",
            status_code=303,
        )

    return templates.TemplateResponse(
        "staff/complaint_detail.html",
        {
            "request": request,
            "user": user,
            "complaint": data["complaint"],
            "history": data["history"],
            "attachments": data["attachments"],
            "db_enabled": settings.db_enabled,
            "error": request.query_params.get("error"),
            "success": request.query_params.get("success"),
        },
    )


# ── Status Update ──────────────────────────────────────────────────────────────

@router.post("/complaints/{complaint_id}/status")
async def update_status(
    request: Request,
    complaint_id: int,
    new_status: str = Form(...),
    remarks: str = Form(...),
):
    user = _require_staff(request)
    if not user:
        return RedirectResponse("/staff/login", status_code=303)

    if not settings.db_enabled:
        return RedirectResponse(
            f"/staff/complaints/{complaint_id}?error={quote('Database not connected.')}",
            status_code=303,
        )

    try:
        from app.repositories import complaint_repository as cr
        cr.update_complaint_status(
            staff_id=user["staff_id"],
            complaint_id=complaint_id,
            new_status=new_status,
            remarks=remarks,
            actor_role=user.get("role_name", "Staff"),
        )
        return RedirectResponse(
            f"/staff/complaints/{complaint_id}?success={quote(f'Status updated to {new_status}.')}",
            status_code=303,
        )
    except (ValueError, PermissionError) as exc:
        return RedirectResponse(
            f"/staff/complaints/{complaint_id}?error={quote(str(exc))}",
            status_code=303,
        )
    except Exception as exc:
        logger.exception("Status update error: %s", exc)
        return RedirectResponse(
            f"/staff/complaints/{complaint_id}?error={quote('Failed to update status.')}",
            status_code=303,
        )


# ── Profile ────────────────────────────────────────────────────────────────────

@router.get("/profile", response_class=HTMLResponse)
async def staff_profile(request: Request):
    user = _require_staff(request)
    if not user:
        return RedirectResponse("/staff/login", status_code=303)
    return templates.TemplateResponse(
        "staff/profile.html",
        {"request": request, "user": user},
    )
