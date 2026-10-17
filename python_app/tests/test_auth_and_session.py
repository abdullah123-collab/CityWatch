"""
Tests for security, password hashing, signed sessions, and role authorization.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.security import (
    create_session_cookie,
    get_current_user,
    hash_password,
    read_session_cookie,
    verify_password,
)

client = TestClient(app, follow_redirects=False)


# ── Password Hashing Compatibility ─────────────────────────────────────────────

def test_bcrypt_hash_and_verify():
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)

    assert hashed.startswith("$2b$12$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False
    assert verify_password("", hashed) is False


def test_verify_password_handles_garbage_gracefully():
    assert verify_password("password", "invalid-hash-string") is False
    assert verify_password("password", "") is False


# ── Session Signatures & Tamper Resistance ─────────────────────────────────────

def test_session_cookie_encode_and_decode():
    payload = {
        "account_id": 42,
        "role_name": "Citizen",
        "citizen_id": 99,
        "full_name": "Jane Citizen",
        "email": "jane@example.com",
    }
    token = create_session_cookie(payload)
    decoded = read_session_cookie(token)

    assert decoded is not None
    assert decoded["account_id"] == 42
    assert decoded["role_name"] == "Citizen"
    assert decoded["citizen_id"] == 99
    assert decoded["full_name"] == "Jane Citizen"


def test_session_cookie_rejects_tampering():
    payload = {"account_id": 1, "role_name": "Citizen"}
    token = create_session_cookie(payload)

    # Tamper with the token string
    tampered = token[:-4] + "xyz1"
    assert read_session_cookie(tampered) is None


def test_session_cookie_rejects_empty():
    assert read_session_cookie("") is None
    assert read_session_cookie(None) is None


# ── Role Enforcement Across Portals ────────────────────────────────────────────

def test_citizen_cannot_access_staff_dashboard():
    citizen_user = {
        "account_id": 10,
        "role_name": "Citizen",
        "citizen_id": 5,
        "full_name": "Resident Bob",
    }
    cookie = create_session_cookie(citizen_user)
    client.cookies.set(settings.session_cookie_name, cookie)

    response = client.get("/staff/dashboard")
    assert response.status_code == 303
    assert response.headers["location"] == "/staff/login"


def test_citizen_cannot_access_admin_dashboard():
    citizen_user = {
        "account_id": 10,
        "role_name": "Citizen",
        "citizen_id": 5,
        "full_name": "Resident Bob",
    }
    cookie = create_session_cookie(citizen_user)
    client.cookies.set(settings.session_cookie_name, cookie)

    response = client.get("/admin/dashboard")
    assert response.status_code == 303
    assert response.headers["location"] == "/admin/login"


def test_staff_cannot_access_admin_dashboard():
    staff_user = {
        "account_id": 20,
        "role_name": "Staff",
        "staff_id": 7,
        "full_name": "Officer Alice",
    }
    cookie = create_session_cookie(staff_user)
    client.cookies.set(settings.session_cookie_name, cookie)

    response = client.get("/admin/dashboard")
    assert response.status_code == 303
    assert response.headers["location"] == "/admin/login"


def test_logout_clears_session_cookie():
    citizen_user = {"account_id": 10, "role_name": "Citizen", "citizen_id": 5}
    cookie = create_session_cookie(citizen_user)
    client.cookies.set(settings.session_cookie_name, cookie)

    response = client.post("/logout")
    assert response.status_code == 303
    assert response.headers["location"].startswith("/login")
    assert settings.session_cookie_name in response.headers.get("set-cookie", "")
