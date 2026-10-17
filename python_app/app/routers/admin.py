"""
Admin Portal Router

All routes require Admin role session.

Routes (mounted at /admin/):
  GET  /admin/              → Redirect to dashboard
  GET  /admin/login         → Admin login form
  POST /admin/login         → Process admin login
  POST /admin/logout        → Log out
  GET  /admin/dashboard     → Admin overview with metrics
  GET  /admin/complaints    → All complaints with filters
  GET  /admin/complaints/{id}  → Full complaint case file
  POST /admin/complaints/{id}/assign  → Assign to staff
  GET  /admin/staff         → Staff management
  POST /admin/staff         → Create staff account
  PATCH/POST /admin/staff/{id}/status  → Activate/deactivate staff
  GET  /admin/citizens      → Citizens list
  GET  /admin/departments   → Departments list
  POST /admin/departments   → Create department
  GET  /admin/feedback      → All feedback
  GET  /admin/audit-logs    → Audit log viewer
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

router = APIRouter(tags=["admin"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _require_admin(request: Request):
    user = get_current_user(request)
    if not user or user.get("role_name") != "Admin":
        return None
    return user


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


# ── Root redirect ──────────────────────────────────────────────────────────────

@router.get("/", response_class=HTMLResponse)
async def admin_root(request: Request):
    user = _require_admin(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)
    return RedirectResponse("/admin/dashboard", status_code=303)


# ── Login ──────────────────────────────────────────────────────────────────────

@router.get("/login", response_class=HTMLResponse)
async def admin_login_page(request: Request):
    user = get_current_user(request)
    if user and user.get("role_name") == "Admin":
        return RedirectResponse("/admin/dashboard", status_code=303)
    return templates.TemplateResponse(
        "admin/login.html",
        {
            "request": request,
            "error": request.query_params.get("error"),
            "db_enabled": settings.db_enabled,
        },
    )


@router.post("/login")
async def admin_login_submit(
    request: Request,
    email: str = Form(None),
    identifier: str = Form(None),
    password: str = Form(...),
):
    staff_id_or_email = (identifier or email or "").strip()
    if not staff_id_or_email or not password:
        return RedirectResponse(
            f"/admin/login?error={quote('Invalid credentials.')}",
            status_code=303,
        )

    if settings.db_enabled:
        try:
            from app.repositories import auth_repository as ar
            user = ar.login_staff(staff_id_or_email, password)
            if not user or user.get("role_name") != "Admin":
                return RedirectResponse(
                    f"/admin/login?error={quote('Invalid credentials.')}",
                    status_code=303,
                )
            response = RedirectResponse("/admin/dashboard", status_code=303)
            _set_session(response, user)
            return response
        except Exception as exc:
            logger.exception("Admin login error: %s", exc)
            return RedirectResponse(
                f"/admin/login?error={quote('An error occurred during authentication.')}",
                status_code=303,
            )
    else:
        # Offline / Demo mode
        if getattr(settings, "demo_mode", True):
            from app.core.demo_accounts import authenticate_demo_admin
            user = authenticate_demo_admin(staff_id_or_email, password)
            if not user or user.get("role_name") != "Admin":
                return RedirectResponse(
                    f"/admin/login?error={quote('Invalid credentials.')}",
                    status_code=303,
                )
            response = RedirectResponse("/admin/dashboard", status_code=303)
            _set_session(response, user)
            return response
        else:
            return RedirectResponse(
                f"/admin/login?error={quote('Database not yet connected and demo mode is disabled.')}",
                status_code=303,
            )



# ── Logout ─────────────────────────────────────────────────────────────────────

@router.post("/logout")
async def admin_logout(request: Request):
    response = RedirectResponse("/admin/login", status_code=303)
    response.delete_cookie(key=settings.session_cookie_name)
    return response

@router.get("/logout")
async def admin_logout_get(request: Request):
    response = RedirectResponse("/admin/login", status_code=303)
    response.delete_cookie(key=settings.session_cookie_name)
    return response


# ── Dashboard ──────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_class=HTMLResponse)
async def admin_dashboard(request: Request):
    user = _require_admin(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)

    data = None
    db_error = None
    if settings.db_enabled:
        try:
            from app.repositories import admin_repository as ar
            data = ar.get_admin_dashboard()
        except Exception as exc:
            logger.error("Admin dashboard error: %s", exc)
            db_error = str(exc)

    return templates.TemplateResponse(
        "admin/dashboard.html",
        {
            "request": request,
            "user": user,
            "data": data,
            "db_enabled": settings.db_enabled,
            "db_error": db_error,
            "error": request.query_params.get("error"),
        },
    )


# ── Complaints ─────────────────────────────────────────────────────────────────

@router.get("/complaints", response_class=HTMLResponse)
async def admin_complaints(
    request: Request,
    search: str = "",
    dept_id: str = "",
    status_filter: str = "All",
    priority: str = "All",
    sort: str = "newest",
):
    user = _require_admin(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)

    complaints = []
    departments = []
    db_error = None

    if settings.db_enabled:
        try:
            from app.repositories import complaint_repository as cr
            from app.repositories import admin_repository as ar
            departments = ar.get_all_departments()
            complaints = cr.get_all_complaints(
                search=search or None,
                department_id=int(dept_id) if dept_id else None,
                status=status_filter if status_filter != "All" else None,
                priority=priority if priority != "All" else None,
                sort=sort,
            )
        except Exception as exc:
            logger.error("Admin complaints error: %s", exc)
            db_error = str(exc)

    return templates.TemplateResponse(
        "admin/complaints.html",
        {
            "request": request,
            "user": user,
            "complaints": complaints,
            "departments": departments,
            "filters": {
                "search": search,
                "dept_id": dept_id,
                "status": status_filter,
                "priority": priority,
                "sort": sort,
            },
            "db_enabled": settings.db_enabled,
            "db_error": db_error,
        },
    )


@router.get("/complaints/{complaint_id}", response_class=HTMLResponse)
async def admin_complaint_detail(request: Request, complaint_id: int):
    user = _require_admin(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)

    if not settings.db_enabled:
        return templates.TemplateResponse(
            "admin/complaint_detail.html",
            {
                "request": request,
                "user": user,
                "complaint": None,
                "history": [],
                "attachments": [],
                "feedback": [],
                "available_staff": [],
                "db_enabled": False,
                "error": "Database not connected.",
            },
        )

    try:
        from app.repositories import complaint_repository as cr
        from app.repositories import admin_repository as ar
        data = cr.get_complaint_details(complaint_id, user)
        all_staff = ar.get_all_staff()
    except Exception as exc:
        logger.error("Admin complaint detail error: %s", exc)
        return RedirectResponse(
            f"/admin/complaints?error={quote(str(exc))}", status_code=303
        )

    return templates.TemplateResponse(
        "admin/complaint_detail.html",
        {
            "request": request,
            "user": user,
            "complaint": data["complaint"],
            "history": data["history"],
            "attachments": data["attachments"],
            "feedback": data["feedback"],
            "available_staff": all_staff,
            "db_enabled": settings.db_enabled,
            "error": request.query_params.get("error"),
            "success": request.query_params.get("success"),
        },
    )


@router.post("/complaints/{complaint_id}/assign")
async def assign_complaint(
    request: Request,
    complaint_id: int,
    staff_id: int = Form(...),
):
    user = _require_admin(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)

    if not settings.db_enabled:
        return RedirectResponse(
            f"/admin/complaints/{complaint_id}?error={quote('Database not connected.')}",
            status_code=303,
        )

    try:
        from app.repositories import complaint_repository as cr
        result = cr.assign_complaint(
            complaint_id=complaint_id,
            staff_id=staff_id,
            admin_name=user.get("full_name", "Administrator"),
        )
        staff_name = result.get("staff_name", "Staff")
        return RedirectResponse(
            f"/admin/complaints/{complaint_id}?success={quote(f'Complaint assigned to {staff_name}.')}",
            status_code=303,
        )
    except (ValueError, Exception) as exc:
        return RedirectResponse(
            f"/admin/complaints/{complaint_id}?error={quote(str(exc))}",
            status_code=303,
        )


# ── Staff Management ───────────────────────────────────────────────────────────

@router.get("/staff", response_class=HTMLResponse)
async def admin_staff(request: Request):
    user = _require_admin(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)

    staff_list = []
    departments = []
    db_error = None

    if settings.db_enabled:
        try:
            from app.repositories import admin_repository as ar
            staff_list = ar.get_all_staff()
            departments = ar.get_all_departments()
        except Exception as exc:
            logger.error("Admin staff list error: %s", exc)
            db_error = str(exc)

    return templates.TemplateResponse(
        "admin/staff.html",
        {
            "request": request,
            "user": user,
            "staff_list": staff_list,
            "departments": departments,
            "db_enabled": settings.db_enabled,
            "db_error": db_error,
            "error": request.query_params.get("error"),
            "success": request.query_params.get("success"),
        },
    )


@router.post("/staff")
async def admin_create_staff(
    request: Request,
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    designation: str = Form(...),
    dept_id: int = Form(...),
    role_name: str = Form("Staff"),
    password: str = Form(...),
):
    user = _require_admin(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)

    if not settings.db_enabled:
        return RedirectResponse(
            f"/admin/staff?error={quote('Database not connected.')}",
            status_code=303,
        )

    try:
        from app.repositories import admin_repository as ar
        created = ar.create_staff_account(
            full_name=full_name.strip(),
            email=email.strip().lower(),
            phone=phone.strip(),
            designation=designation.strip(),
            dept_id=dept_id,
            role_name=role_name,
            password=password,
        )
        staff_member_name = created.get("full_name", "Staff")
        return RedirectResponse(
            f"/admin/staff?success={quote(f'Staff account created for {staff_member_name}.')}",
            status_code=303,
        )
    except Exception as exc:
        return RedirectResponse(
            f"/admin/staff?error={quote(str(exc))}",
            status_code=303,
        )


@router.post("/staff/{staff_id}/status")
async def admin_toggle_staff_status(
    request: Request,
    staff_id: int,
    is_active: str = Form(...),  # "1" or "0"
):
    user = _require_admin(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)

    if not settings.db_enabled:
        return RedirectResponse(
            f"/admin/staff?error={quote('Database not connected.')}",
            status_code=303,
        )

    try:
        from app.repositories import admin_repository as ar
        active = is_active in ("1", "true", "True", "yes")
        ar.set_staff_active_status(staff_id, active)
        label = "activated" if active else "deactivated"
        return RedirectResponse(
            f"/admin/staff?success={quote(f'Staff #{staff_id} has been {label}.')}",
            status_code=303,
        )
    except Exception as exc:
        return RedirectResponse(
            f"/admin/staff?error={quote(str(exc))}",
            status_code=303,
        )


# ── Citizens ───────────────────────────────────────────────────────────────────

@router.get("/citizens", response_class=HTMLResponse)
async def admin_citizens(request: Request):
    user = _require_admin(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)

    citizens = []
    db_error = None

    if settings.db_enabled:
        try:
            from app.repositories import admin_repository as ar
            citizens = ar.get_all_citizens()
        except Exception as exc:
            logger.error("Admin citizens error: %s", exc)
            db_error = str(exc)

    return templates.TemplateResponse(
        "admin/citizens.html",
        {
            "request": request,
            "user": user,
            "citizens": citizens,
            "db_enabled": settings.db_enabled,
            "db_error": db_error,
        },
    )


# ── Departments ────────────────────────────────────────────────────────────────

@router.get("/departments", response_class=HTMLResponse)
async def admin_departments(request: Request):
    user = _require_admin(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)

    departments = []
    db_error = None

    if settings.db_enabled:
        try:
            from app.repositories import admin_repository as ar
            departments = ar.get_all_departments()
        except Exception as exc:
            logger.error("Admin departments error: %s", exc)
            db_error = str(exc)

    return templates.TemplateResponse(
        "admin/departments.html",
        {
            "request": request,
            "user": user,
            "departments": departments,
            "db_enabled": settings.db_enabled,
            "db_error": db_error,
            "error": request.query_params.get("error"),
            "success": request.query_params.get("success"),
        },
    )


@router.post("/departments")
async def admin_create_department(
    request: Request,
    dept_name: str = Form(...),
    category: str = Form(...),
    contact_email: str = Form(""),
    contact_phone: str = Form(""),
    head_officer: str = Form(""),
):
    user = _require_admin(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)

    if not settings.db_enabled:
        return RedirectResponse(
            f"/admin/departments?error={quote('Database not connected.')}",
            status_code=303,
        )

    try:
        from app.repositories import admin_repository as ar
        dept = ar.create_department(
            dept_name=dept_name.strip(),
            category=category.strip(),
            contact_email=contact_email.strip() or None,
            contact_phone=contact_phone.strip() or None,
            head_officer=head_officer.strip() or None,
        )
        dept_name = dept.get("dept_name", "Department")
        return RedirectResponse(
            f"/admin/departments?success={quote(f'Department \"{dept_name}\" created.')}",
            status_code=303,
        )
    except Exception as exc:
        return RedirectResponse(
            f"/admin/departments?error={quote(str(exc))}",
            status_code=303,
        )


# ── Feedback ───────────────────────────────────────────────────────────────────

@router.get("/feedback", response_class=HTMLResponse)
async def admin_feedback(request: Request):
    user = _require_admin(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)

    feedback = []
    db_error = None

    if settings.db_enabled:
        try:
            from app.repositories import admin_repository as ar
            feedback = ar.get_all_feedback()
        except Exception as exc:
            logger.error("Admin feedback error: %s", exc)
            db_error = str(exc)

    return templates.TemplateResponse(
        "admin/feedback.html",
        {
            "request": request,
            "user": user,
            "feedback": feedback,
            "db_enabled": settings.db_enabled,
            "db_error": db_error,
        },
    )


# ── Audit Logs ─────────────────────────────────────────────────────────────────

@router.get("/audit-logs", response_class=HTMLResponse)
async def admin_audit_logs(request: Request):
    user = _require_admin(request)
    if not user:
        return RedirectResponse("/admin/login", status_code=303)

    logs = []
    db_error = None

    if settings.db_enabled:
        try:
            from app.repositories import admin_repository as ar
            logs = ar.get_audit_logs()
        except Exception as exc:
            logger.error("Admin audit logs error: %s", exc)
            db_error = str(exc)

    return templates.TemplateResponse(
        "admin/audit_logs.html",
        {
            "request": request,
            "user": user,
            "logs": logs,
            "db_enabled": settings.db_enabled,
            "db_error": db_error,
        },
    )
