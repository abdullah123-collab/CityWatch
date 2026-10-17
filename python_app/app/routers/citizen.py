"""
Citizen Portal Router

Routes:
  GET  /                      → Landing page (departments shown if DB enabled)
  GET  /login                 → Citizen login form
  POST /login                 → Process login
  GET  /register              → Citizen registration form
  POST /register              → Process registration
  GET  /dashboard             → Citizen dashboard (requires login)
  GET  /complaints            → Complaint history listing
  GET  /complaints/new        → New complaint form
  POST /complaints/new        → Submit complaint
  GET  /complaints/{id}       → Complaint detail view
  POST /complaints/{id}/feedback → Submit feedback
  GET  /complaints/{id}/attachments/{att_id} → Download attachment
  GET  /profile               → Citizen profile
  POST /logout                → Log out
"""
from __future__ import annotations

import io
import logging
import os
import re
import uuid
from datetime import date
from pathlib import Path
from typing import Annotated

from fastapi import (
    APIRouter, Cookie, File, Form, Request, Response,
    UploadFile, status,
)
from fastapi.responses import (
    FileResponse, HTMLResponse, RedirectResponse, StreamingResponse,
)
from app.core.config import settings
from app.core.security import (
    create_session_cookie,
    get_current_user,
    read_session_cookie,
)
from app.core.templates import templates

logger = logging.getLogger(__name__)

router = APIRouter(tags=["citizen"])

# ── Helpers ────────────────────────────────────────────────────────────────────

def _set_session(response: Response, user: dict) -> None:
    token = create_session_cookie(user)
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_max_age_seconds,
        httponly=True,
        samesite="lax",
        secure=settings.environment == "production",
    )


def _clear_session(response: Response) -> None:
    response.delete_cookie(key=settings.session_cookie_name)


def _flash(request: Request, message: str, category: str = "error") -> None:
    """Store a flash message in the request state (available in templates)."""
    if not hasattr(request.state, "flash"):
        request.state.flash = []
    request.state.flash.append({"message": message, "category": category})


def _get_flash(request: Request) -> list:
    return getattr(request.state, "flash", [])


def _redirect_with_error(url: str, error: str) -> RedirectResponse:
    """Redirect with error in query string."""
    from urllib.parse import urlencode, quote
    return RedirectResponse(
        f"{url}?error={quote(error)}", status_code=status.HTTP_303_SEE_OTHER
    )


def _validate_location(form_data: dict) -> dict:
    area = form_data.get("areaName", "").strip()
    city = form_data.get("city", "").strip()
    district = form_data.get("district", "").strip()
    pincode = form_data.get("pincode", "").strip()

    errors = []
    if not area:
        errors.append("Area / locality is required.")
    if not city:
        errors.append("City is required.")
    if not district:
        errors.append("District is required.")
    if not re.match(r"^[A-Za-z0-9\-]{3,10}$", pincode):
        errors.append("A valid postal code (3–10 alphanumeric characters) is required.")

    if errors:
        raise ValueError(" ".join(errors))

    return {
        "areaName": area[:100],
        "city": city[:80],
        "district": district[:80],
        "pincode": pincode[:10],
        "latitude": None,
        "longitude": None,
    }


def _save_upload(file: UploadFile, complaint_id_hint: str) -> dict | None:
    """Save an uploaded file and return its metadata dict, or None on failure."""
    try:
        contents = file.file.read()
        if len(contents) > settings.max_upload_size_bytes:
            logger.warning("Upload %s exceeds size limit, skipped.", file.filename)
            return None

        upload_dir = settings.upload_path
        upload_dir.mkdir(parents=True, exist_ok=True)

        safe_name = re.sub(r"[^\w.\-]", "_", file.filename or "upload")
        unique_name = f"{uuid.uuid4().hex}_{safe_name}"
        dest = upload_dir / unique_name
        dest.write_bytes(contents)

        return {
            "file_name": file.filename,
            "file_path": str(dest),
            "mime_type": file.content_type or "application/octet-stream",
            "file_size": len(contents),
        }
    except Exception as exc:
        logger.error("Failed to save upload %s: %s", file.filename, exc)
        return None


def _get_departments():
    """Return department list from DB or empty list if offline."""
    if not settings.db_enabled:
        return []
    try:
        from app.repositories import admin_repository as ar
        return ar.get_all_departments()
    except Exception as exc:
        logger.warning("Could not fetch departments: %s", exc)
        return []


# ── Landing page ───────────────────────────────────────────────────────────────

@router.get("/", response_class=HTMLResponse)
async def landing(request: Request):
    user = get_current_user(request)
    if user and user.get("role_name") == "Citizen":
        return RedirectResponse("/dashboard", status_code=303)
    departments = _get_departments()
    return templates.TemplateResponse(
        "citizen/landing.html",
        {
            "request": request,
            "user": user,
            "departments": departments,
            "error": request.query_params.get("error"),
        },
    )


# ── Auth: Login ────────────────────────────────────────────────────────────────

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    user = get_current_user(request)
    if user and user.get("role_name") == "Citizen":
        return RedirectResponse("/dashboard", status_code=303)
    return templates.TemplateResponse(
        "citizen/login.html",
        {
            "request": request,
            "error": request.query_params.get("error"),
            "success": request.query_params.get("success"),
            "db_enabled": settings.db_enabled,
        },
    )


@router.post("/login")
async def login_submit(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
):
    from urllib.parse import quote

    if settings.db_enabled:
        try:
            from app.repositories import auth_repository as ar
            user = ar.login_citizen(email.strip().lower(), password)
            if not user:
                return RedirectResponse(
                    f"/login?error={quote('Invalid email or password.')}",
                    status_code=303,
                )
            response = RedirectResponse("/dashboard", status_code=303)
            _set_session(response, user)
            return response
        except ValueError as exc:
            return RedirectResponse(
                f"/login?error={quote(str(exc))}",
                status_code=303,
            )
        except Exception as exc:
            logger.exception("Login error: %s", exc)
            return RedirectResponse(
                f"/login?error={quote('An error occurred. Please try again.')}",
                status_code=303,
            )
    else:
        # Offline demo mode
        if getattr(settings, "demo_mode", True):
            from app.core.demo_accounts import authenticate_demo_citizen
            user = authenticate_demo_citizen(email.strip().lower(), password)
            if not user:
                return RedirectResponse(
                    f"/login?error={quote('Invalid email or password.')}",
                    status_code=303,
                )
            response = RedirectResponse("/dashboard", status_code=303)
            _set_session(response, user)
            return response
        else:
            return RedirectResponse(
                f"/login?error={quote('Database not yet connected and demo mode is disabled.')}",
                status_code=303,
            )


# ── Auth: Register ─────────────────────────────────────────────────────────────

@router.get("/register", response_class=HTMLResponse)
async def register_page(request: Request):
    user = get_current_user(request)
    if user and user.get("role_name") == "Citizen":
        return RedirectResponse("/dashboard", status_code=303)
    return templates.TemplateResponse(
        "citizen/register.html",
        {
            "request": request,
            "error": request.query_params.get("error"),
            "form_data": {},
            "db_enabled": settings.db_enabled,
        },
    )



@router.post("/register")
async def register_submit(
    request: Request,
    full_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    address: str = Form(""),
    password: str = Form(...),
    confirm_password: str = Form(...),
):
    from urllib.parse import quote

    # Client-side validated; re-validate server-side
    if password != confirm_password:
        return RedirectResponse(
            f"/register?error={quote('Passwords do not match.')}",
            status_code=303,
        )
    if len(password) < 8:
        return RedirectResponse(
            f"/register?error={quote('Password must be at least 8 characters.')}",
            status_code=303,
        )
    if not re.match(r"^[+()\d\s\-]{7,20}$", phone.strip()):
        return RedirectResponse(
            f"/register?error={quote('Please enter a valid phone number (7–20 digits).')}",
            status_code=303,
        )

    if not settings.db_enabled:
        return RedirectResponse(
            f"/register?error={quote('Database not yet connected. Registration requires SQL Server access.')}",
            status_code=303,
        )

    try:
        from app.repositories import auth_repository as ar
        user = ar.register_citizen(
            full_name=full_name.strip(),
            email=email.strip().lower(),
            phone=phone.strip(),
            address=address.strip() or None,
            password=password,
        )
        response = RedirectResponse("/dashboard", status_code=303)
        _set_session(response, user)
        return response
    except Exception as exc:
        error_msg = str(exc)
        if "2601" in error_msg or "2627" in error_msg or "unique" in error_msg.lower():
            error_msg = "An account with this email address already exists."
        logger.warning("Registration error: %s", exc)
        return RedirectResponse(
            f"/register?error={quote(error_msg)}",
            status_code=303,
        )


# ── Logout ─────────────────────────────────────────────────────────────────────

@router.post("/logout")
async def logout(request: Request):
    response = RedirectResponse("/login?success=Signed+out+successfully.", status_code=303)
    _clear_session(response)
    return response


@router.get("/logout")
async def logout_get(request: Request):
    response = RedirectResponse("/login?success=Signed+out+successfully.", status_code=303)
    _clear_session(response)
    return response


# ── Dashboard ──────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    user = get_current_user(request)
    if not user or user.get("role_name") != "Citizen":
        return RedirectResponse("/login", status_code=303)

    complaints = []
    db_error = None
    if settings.db_enabled:
        try:
            from app.repositories import complaint_repository as cr
            complaints = cr.get_complaints_for_citizen(user["citizen_id"])
        except Exception as exc:
            logger.error("Dashboard load error: %s", exc)
            db_error = str(exc)

    total = len(complaints)
    pending = sum(1 for c in complaints if c["status"] == "Pending")
    in_progress = sum(1 for c in complaints if c["status"] == "In Progress")
    resolved = sum(1 for c in complaints if c["status"] == "Resolved")

    return templates.TemplateResponse(
        "citizen/dashboard.html",
        {
            "request": request,
            "user": user,
            "complaints": complaints[:5],
            "stats": {
                "total": total,
                "pending": pending,
                "in_progress": in_progress,
                "resolved": resolved,
            },
            "db_enabled": settings.db_enabled,
            "db_error": db_error,
        },
    )


# ── Complaint History ──────────────────────────────────────────────────────────

@router.get("/complaints", response_class=HTMLResponse)
async def complaint_history(
    request: Request,
    search: str = "",
    status_filter: str = "",
    priority: str = "",
    sort: str = "newest",
):
    user = get_current_user(request)
    if not user or user.get("role_name") != "Citizen":
        return RedirectResponse("/login", status_code=303)

    complaints = []
    db_error = None
    if settings.db_enabled:
        try:
            from app.repositories import complaint_repository as cr
            complaints = cr.get_complaints_for_citizen(
                user["citizen_id"],
                search=search or None,
                status=status_filter or None,
                priority=priority or None,
                sort=sort,
            )
        except Exception as exc:
            logger.error("Complaint history error: %s", exc)
            db_error = str(exc)

    return templates.TemplateResponse(
        "citizen/complaint_history.html",
        {
            "request": request,
            "user": user,
            "complaints": complaints,
            "filters": {
                "search": search,
                "status": status_filter,
                "priority": priority,
                "sort": sort,
            },
            "db_enabled": settings.db_enabled,
            "db_error": db_error,
        },
    )


# ── New Complaint Form ─────────────────────────────────────────────────────────

@router.get("/complaints/new", response_class=HTMLResponse)
async def new_complaint_form(request: Request):
    user = get_current_user(request)
    if not user or user.get("role_name") != "Citizen":
        return RedirectResponse("/login", status_code=303)

    departments = _get_departments()
    return templates.TemplateResponse(
        "citizen/new_complaint.html",
        {
            "request": request,
            "user": user,
            "departments": departments,
            "error": request.query_params.get("error"),
            "db_enabled": settings.db_enabled,
        },
    )


@router.post("/complaints/new")
async def new_complaint_submit(
    request: Request,
    dept_id: int = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    category: str = Form(...),
    priority: str = Form("Medium"),
    area_name: str = Form(""),
    city: str = Form(""),
    district: str = Form(""),
    pincode: str = Form(""),
    attachments: list[UploadFile] = File(default=[]),
):
    from urllib.parse import quote

    user = get_current_user(request)
    if not user or user.get("role_name") != "Citizen":
        return RedirectResponse("/login", status_code=303)

    if not settings.db_enabled:
        return RedirectResponse(
            f"/complaints/new?error={quote('Database not yet connected. Cannot submit complaints.')}",
            status_code=303,
        )

    # Validate location
    try:
        location = _validate_location({
            "areaName": area_name,
            "city": city,
            "district": district,
            "pincode": pincode,
        })
    except ValueError as exc:
        return RedirectResponse(
            f"/complaints/new?error={quote(str(exc))}",
            status_code=303,
        )

    # Validate inputs
    if not title.strip():
        return RedirectResponse(
            f"/complaints/new?error={quote('Complaint title is required.')}",
            status_code=303,
        )
    if not description.strip():
        return RedirectResponse(
            f"/complaints/new?error={quote('Description is required.')}",
            status_code=303,
        )
    if not category.strip():
        return RedirectResponse(
            f"/complaints/new?error={quote('Category is required.')}",
            status_code=303,
        )

    # Save file uploads
    saved_files = []
    if attachments:
        for upload in attachments:
            if upload.filename:
                meta = _save_upload(upload, "new")
                if meta:
                    saved_files.append(meta)

    try:
        from app.repositories import complaint_repository as cr
        result = cr.create_complaint(
            citizen_id=user["citizen_id"],
            dept_id=dept_id,
            title=title.strip()[:200],
            description=description.strip(),
            category=category.strip()[:80],
            priority=priority,
            location=location,
            file_paths=saved_files,
        )
        return RedirectResponse(
            f"/complaints/{result['complaint_id']}",
            status_code=303,
        )
    except ValueError as exc:
        return RedirectResponse(
            f"/complaints/new?error={quote(str(exc))}",
            status_code=303,
        )
    except Exception as exc:
        logger.exception("Complaint submit error: %s", exc)
        return RedirectResponse(
            f"/complaints/new?error={quote('An error occurred while submitting your complaint.')}",
            status_code=303,
        )


# ── Complaint Detail ───────────────────────────────────────────────────────────

@router.get("/complaints/{complaint_id}", response_class=HTMLResponse)
async def complaint_detail(request: Request, complaint_id: int):
    user = get_current_user(request)
    if not user or user.get("role_name") != "Citizen":
        return RedirectResponse("/login", status_code=303)

    if not settings.db_enabled:
        return templates.TemplateResponse(
            "citizen/complaint_detail.html",
            {
                "request": request,
                "user": user,
                "complaint": None,
                "history": [],
                "attachments": [],
                "feedback": [],
                "db_enabled": False,
                "error": "Database not yet connected.",
            },
        )

    try:
        from app.repositories import complaint_repository as cr
        data = cr.get_complaint_details(complaint_id, user)
    except PermissionError as exc:
        return RedirectResponse(f"/dashboard?error={str(exc)}", status_code=303)
    except ValueError as exc:
        return RedirectResponse(f"/complaints?error={str(exc)}", status_code=303)
    except Exception as exc:
        logger.error("Complaint detail error: %s", exc)
        return templates.TemplateResponse(
            "citizen/complaint_detail.html",
            {
                "request": request,
                "user": user,
                "complaint": None,
                "history": [],
                "attachments": [],
                "feedback": [],
                "db_enabled": True,
                "error": str(exc),
            },
        )

    return templates.TemplateResponse(
        "citizen/complaint_detail.html",
        {
            "request": request,
            "user": user,
            "complaint": data["complaint"],
            "history": data["history"],
            "attachments": data["attachments"],
            "feedback": data["feedback"],
            "db_enabled": settings.db_enabled,
            "error": request.query_params.get("error"),
            "success": request.query_params.get("success"),
        },
    )


# ── Feedback Submit ────────────────────────────────────────────────────────────

@router.post("/complaints/{complaint_id}/feedback")
async def submit_feedback(
    request: Request,
    complaint_id: int,
    rating: int = Form(...),
    comments: str = Form(""),
):
    from urllib.parse import quote

    user = get_current_user(request)
    if not user or user.get("role_name") != "Citizen":
        return RedirectResponse("/login", status_code=303)

    if not settings.db_enabled:
        return RedirectResponse(
            f"/complaints/{complaint_id}?error={quote('Database not connected.')}",
            status_code=303,
        )

    try:
        from app.repositories import complaint_repository as cr
        cr.add_feedback(complaint_id, user["citizen_id"], rating, comments.strip() or None)
        return RedirectResponse(
            f"/complaints/{complaint_id}?success={quote('Thank you for your feedback!')}",
            status_code=303,
        )
    except Exception as exc:
        return RedirectResponse(
            f"/complaints/{complaint_id}?error={quote(str(exc))}",
            status_code=303,
        )


# ── Attachment Download ────────────────────────────────────────────────────────

@router.get("/complaints/{complaint_id}/attachments/{attachment_id}")
async def download_attachment(request: Request, complaint_id: int, attachment_id: int):
    user = get_current_user(request)
    if not user:
        return RedirectResponse("/login", status_code=303)

    if not settings.db_enabled:
        return HTMLResponse("Database not connected.", status_code=503)

    try:
        from app.repositories import complaint_repository as cr
        meta = cr.get_attachment_meta(complaint_id, attachment_id)
        if not meta:
            return HTMLResponse("Attachment not found.", status_code=404)

        file_path = Path(meta["file_path"])
        if not file_path.exists():
            return HTMLResponse("Attachment file not found on disk.", status_code=404)

        return FileResponse(
            path=str(file_path),
            media_type=meta.get("mime_type") or "application/octet-stream",
            filename=meta["file_name"],
        )
    except Exception as exc:
        logger.error("Attachment download error: %s", exc)
        return HTMLResponse("Could not retrieve attachment.", status_code=500)


# ── Profile ────────────────────────────────────────────────────────────────────

@router.get("/profile", response_class=HTMLResponse)
async def profile(request: Request):
    user = get_current_user(request)
    if not user or user.get("role_name") != "Citizen":
        return RedirectResponse("/login", status_code=303)
    return templates.TemplateResponse(
        "citizen/profile.html",
        {"request": request, "user": user},
    )
