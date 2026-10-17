"""
Tests for Staff and Admin Authentication, Department Validation, and Demo Mode.

Verifies:
  1. Staff login with correct department selection succeeds and sets session cookie.
  2. Staff login with invalid department selection (mismatch) is strictly rejected.
  3. Staff login with invalid credentials (wrong password, unknown user) is rejected.
  4. Staff login works with both numeric Staff ID and official Email address.
  5. Admin login with correct credentials succeeds.
  6. Admin login with invalid credentials or non-admin roles is rejected.
  7. Admin portal pages are protected against non-admin roles.
  8. Password hashing uses salted bcrypt; complexity rules are enforced.
  9. Safe account manager provisioning and listing behavior.
 10. Staff login page renders the department dropdown with demo/DB departments.
"""
from urllib.parse import unquote

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.security import create_session_cookie, read_session_cookie, hash_password, verify_password
from app.core.account_manager import validate_password_strength, list_accounts_safe, create_admin_account_safe

client = TestClient(app, follow_redirects=False)


# ── Staff Login: Department Dropdown & Rendering ───────────────────────────────

def test_staff_login_page_renders_department_dropdown():
    response = client.get("/staff/login")
    assert response.status_code == 200
    assert "Assigned Department" in response.text
    assert 'name="dept_id"' in response.text
    assert 'id="dept_id"' in response.text
    assert "Sanitation" in response.text
    assert "Roads" in response.text
    assert "Water" in response.text
    assert "Electricity" in response.text


# ── Staff Login: Valid Credentials & Department ────────────────────────────────

def test_staff_login_with_valid_department_and_email():
    """Ahmed Khan belongs to Dept 1 (Sanitation). Valid login with email."""
    response = client.post(
        "/staff/login",
        data={
            "dept_id": "1",
            "identifier": "ahmed.staff@example.com",
            "password": "StaffPass123!",
        },
    )
    assert response.status_code == 303
    assert response.headers["location"] == "/staff/dashboard"
    cookie = response.cookies.get(settings.session_cookie_name)
    assert cookie is not None
    user = read_session_cookie(cookie)
    assert user is not None
    assert user["role_name"] == "Staff"
    assert user["dept_id"] == 1
    assert "Ahmed Khan" in user["full_name"]


def test_staff_login_with_valid_department_and_staff_id():
    """Usman Tariq has Staff ID 2 in Dept 2 (Roads). Valid login with numeric ID."""
    response = client.post(
        "/staff/login",
        data={
            "dept_id": "2",
            "identifier": "2",
            "password": "StaffPass123!",
        },
    )
    assert response.status_code == 303
    assert response.headers["location"] == "/staff/dashboard"
    cookie = response.cookies.get(settings.session_cookie_name)
    user = read_session_cookie(cookie)
    assert user["staff_id"] == 2
    assert user["dept_id"] == 2
    assert user["role_name"] == "Staff"


# ── Staff Login: Invalid Department Selection (Mismatch) ──────────────────────

def test_staff_login_rejects_department_mismatch():
    """
    Ahmed Khan is in Dept 1 (Sanitation).
    Attempting to log in selecting Dept 2 (Roads) MUST be rejected.
    """
    response = client.post(
        "/staff/login",
        data={
            "dept_id": "2",  # Mismatch! Ahmed belongs to 1, not 2
            "identifier": "ahmed.staff@example.com",
            "password": "StaffPass123!",
        },
    )
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "Invalid credentials or department selection" in decoded_loc
    assert settings.session_cookie_name not in response.cookies


def test_staff_login_rejects_numeric_id_department_mismatch():
    """
    Staff ID 3 (Hassan Raza) is in Dept 3 (Water).
    Attempting to log in selecting Dept 4 (Electricity) MUST be rejected.
    """
    response = client.post(
        "/staff/login",
        data={
            "dept_id": "4",  # Mismatch! Hassan belongs to 3, not 4
            "identifier": "3",
            "password": "StaffPass123!",
        },
    )
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "Invalid credentials or department selection" in decoded_loc
    assert settings.session_cookie_name not in response.cookies


# ── Staff Login: Invalid Credentials ──────────────────────────────────────────

def test_staff_login_rejects_wrong_password():
    response = client.post(
        "/staff/login",
        data={
            "dept_id": "1",
            "identifier": "ahmed.staff@example.com",
            "password": "WrongPassword123!",
        },
    )
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "Invalid credentials or department selection" in decoded_loc
    assert settings.session_cookie_name not in response.cookies


def test_staff_login_rejects_unknown_staff_id():
    response = client.post(
        "/staff/login",
        data={
            "dept_id": "1",
            "identifier": "9999",
            "password": "StaffPass123!",
        },
    )
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "Invalid credentials or department selection" in decoded_loc
    assert settings.session_cookie_name not in response.cookies


def test_staff_login_requires_department():
    """Submitting staff login without dept_id returns 422 Unprocessable Entity."""
    response = client.post(
        "/staff/login",
        data={
            "identifier": "ahmed.staff@example.com",
            "password": "StaffPass123!",
        },
    )
    assert response.status_code == 422


# ── Admin Login & Role Protection ─────────────────────────────────────────────

def test_admin_login_with_valid_credentials():
    response = client.post(
        "/admin/login",
        data={
            "email": "admin@citywatch.gov",
            "password": "AdminPass123!",
        },
    )
    assert response.status_code == 303
    assert response.headers["location"] == "/admin/dashboard"
    cookie = response.cookies.get(settings.session_cookie_name)
    assert cookie is not None
    user = read_session_cookie(cookie)
    assert user["role_name"] == "Admin"
    assert user["email"] == "admin@citywatch.gov"


def test_admin_login_rejects_wrong_password():
    response = client.post(
        "/admin/login",
        data={
            "email": "admin@citywatch.gov",
            "password": "WrongPassword123!",
        },
    )
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "Invalid credentials" in decoded_loc
    assert settings.session_cookie_name not in response.cookies


def test_admin_login_rejects_staff_credentials():
    """A Staff member attempting to log in through the Admin portal must be rejected."""
    response = client.post(
        "/admin/login",
        data={
            "email": "ahmed.staff@example.com",
            "password": "StaffPass123!",
        },
    )
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "Invalid credentials" in decoded_loc
    assert settings.session_cookie_name not in response.cookies


def test_admin_dashboard_rejects_staff_cookie():
    staff_user = {
        "account_id": 1,
        "staff_id": 1,
        "role_name": "Staff",
        "full_name": "Ahmed Staff",
    }
    client.cookies.set(settings.session_cookie_name, create_session_cookie(staff_user))
    response = client.get("/admin/dashboard")
    assert response.status_code == 303
    assert response.headers["location"] == "/admin/login"


def test_admin_dashboard_rejects_citizen_cookie():
    citizen_user = {
        "account_id": 1,
        "citizen_id": 1,
        "role_name": "Citizen",
        "full_name": "Jane Citizen",
    }
    client.cookies.set(settings.session_cookie_name, create_session_cookie(citizen_user))
    response = client.get("/admin/dashboard")
    assert response.status_code == 303
    assert response.headers["location"] == "/admin/login"


# ── Password Security & Validation ────────────────────────────────────────────

def test_password_hashing_and_verification():
    pw = "SecureP@ssw0rd2026!"
    hashed = hash_password(pw)
    assert hashed.startswith("$2b$12$")
    assert verify_password(pw, hashed) is True
    assert verify_password("IncorrectPassword", hashed) is False


def test_password_strength_validation():
    with pytest.raises(ValueError, match="at least 8 characters"):
        validate_password_strength("short")

    with pytest.raises(ValueError, match="at least one letter"):
        validate_password_strength("1234567890!")

    with pytest.raises(ValueError, match="number or special character"):
        validate_password_strength("abcdefghijkl")

    # Valid complex password raises no exception
    validate_password_strength("SecureP@ssw0rd")


# ── Account Manager Safe Behavior ─────────────────────────────────────────────

def test_account_manager_offline_safety(monkeypatch):
    """When DB is disabled, safe creation raises RuntimeError with clear prerequisites."""
    monkeypatch.setattr(settings, "db_enabled", False)
    with pytest.raises(RuntimeError) as exc_info:
        create_admin_account_safe(
            full_name="New Admin",
            email="new.admin@citywatch.gov",
            phone="03001112233",
            designation="Administrator",
            password="StrongPassword123!",
        )
    assert "Database access is currently disabled" in str(exc_info.value)
    assert "DB_ENABLED=false" in str(exc_info.value)


def test_list_accounts_safe_reports_demo_mode_honestly(monkeypatch):
    monkeypatch.setattr(settings, "db_enabled", False)
    info = list_accounts_safe()
    assert info["db_enabled"] is False
    assert "Local Demo Configuration" in info["source"]
    assert len(info["accounts"]) >= 5
    for a in info["accounts"]:
        assert "password_hash" not in a
        assert "Offline Development Only" in a["source"]


# ── Citizen Demo Auth ─────────────────────────────────────────────────────────

def test_demo_citizen_login_succeeds():
    response = client.post(
        "/login",
        data={
            "email": "ali.ahmed@example.com",
            "password": "Citizen123!",
        },
    )
    assert response.status_code == 303
    assert response.headers["location"] == "/dashboard"
    cookie = response.cookies.get(settings.session_cookie_name)
    assert cookie is not None
    user = read_session_cookie(cookie)
    assert user["role_name"] == "Citizen"
    assert user["email"] == "ali.ahmed@example.com"


def test_demo_citizen_login_rejects_wrong_password():
    response = client.post(
        "/login",
        data={
            "email": "ali.ahmed@example.com",
            "password": "WrongPassword123!",
        },
    )
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "Invalid email or password" in decoded_loc
    assert settings.session_cookie_name not in response.cookies

