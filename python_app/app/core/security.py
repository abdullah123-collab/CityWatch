"""
Session and authentication utilities for the CityWatch Python web application.

Sessions use itsdangerous signed cookies so no database table is needed for
offline development.  When db_enabled is True the same token hash used by
the Express backend (Auth_Session) will be consulted so that existing sessions
survive the migration cutover.
"""
from __future__ import annotations

import hashlib
import logging
import secrets
from datetime import datetime, timezone
from typing import Any

import bcrypt
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from fastapi import Cookie, Request

from app.core.config import settings

logger = logging.getLogger(__name__)

_serializer: URLSafeTimedSerializer | None = None


def _get_serializer() -> URLSafeTimedSerializer:
    global _serializer
    if _serializer is None:
        _serializer = URLSafeTimedSerializer(settings.secret_key, salt="citywatch-session")
    return _serializer


# ── Password utilities ─────────────────────────────────────────────────────────

def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash (cost 10-12)."""
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def hash_password(plain: str) -> str:
    """Hash a plaintext password with bcrypt (cost 12)."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")


# ── Session cookie utilities ───────────────────────────────────────────────────

def create_session_cookie(user_data: dict) -> str:
    """
    Sign and encode user data into a session cookie value.
    The cookie stores role, id fields, and expiry metadata.
    """
    return _get_serializer().dumps(user_data)


def read_session_cookie(token: str) -> dict | None:
    """
    Decode and verify a session cookie.
    Returns the user payload dict or None if invalid/expired.
    """
    if not token:
        return None
    try:
        data = _get_serializer().loads(
            token,
            max_age=settings.session_max_age_seconds,
        )
        return data
    except SignatureExpired:
        logger.debug("Session cookie expired.")
        return None
    except BadSignature:
        logger.debug("Session cookie has invalid signature.")
        return None
    except Exception as exc:
        logger.warning("Unexpected error reading session cookie: %s", exc)
        return None


# ── Request helpers ────────────────────────────────────────────────────────────

def get_current_user(request: Request) -> dict | None:
    """Extract and verify the session cookie from a request."""
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        return None
    return read_session_cookie(token)


def require_citizen(request: Request) -> dict:
    """Return current user or raise 401. Asserts role == 'Citizen'."""
    user = get_current_user(request)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Authentication required.")
    if user.get("role_name") != "Citizen":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Citizen access required.")
    return user


def require_staff(request: Request) -> dict:
    """Return current user or raise 401. Asserts role in ('Staff', 'Admin')."""
    user = get_current_user(request)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Authentication required.")
    if user.get("role_name") not in ("Staff", "Admin"):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Staff access required.")
    return user


def require_admin(request: Request) -> dict:
    """Return current user or raise 401. Asserts role == 'Admin'."""
    user = get_current_user(request)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Authentication required.")
    if user.get("role_name") != "Admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Administrator access required.")
    return user
