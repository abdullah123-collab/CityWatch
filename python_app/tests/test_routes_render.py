"""
Tests for route rendering and accessibility across Citizen, Staff, and Admin portals.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.security import create_session_cookie

client = TestClient(app, follow_redirects=False)


def test_health_endpoint_reports_honest_db_status():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    expected = "enabled" if settings.db_enabled else "disabled_pending_approval"
    assert data["database"] == expected
    assert data["service"] == "CityWatch Python Web Application"


def test_api_health_endpoint_matches_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    expected = "enabled" if settings.db_enabled else "disabled_pending_approval"
    assert data["database"] == expected



def test_api_departments_endpoint_returns_json():
    response = client.get("/api/departments")
    assert response.status_code == 200
    data = response.json()
    assert "departments" in data
    assert isinstance(data["departments"], list)



# ── Citizen Unauthenticated Routes ─────────────────────────────────────────────

def test_citizen_landing_renders():
    response = client.get("/")
    assert response.status_code == 200
    assert "Official Municipal Civic Grievance System" in response.text
    assert "CityWatch" in response.text


def test_citizen_login_renders():
    response = client.get("/login")
    assert response.status_code == 200
    assert "Citizen Sign In" in response.text
    assert 'action="/login"' in response.text


def test_citizen_register_renders():
    response = client.get("/register")
    assert response.status_code == 200
    assert "Create Citizen Account" in response.text
    assert 'action="/register"' in response.text


def test_unauthenticated_citizen_redirected_to_login():
    for path in ["/dashboard", "/complaints", "/complaints/new", "/profile"]:
        response = client.get(path)
        assert response.status_code == 303
        assert response.headers["location"] == "/login"


# ── Staff Unauthenticated Routes ───────────────────────────────────────────────

def test_staff_root_redirects_to_login():
    response = client.get("/staff/")
    assert response.status_code == 303
    assert response.headers["location"] == "/staff/login"


def test_staff_login_renders():
    response = client.get("/staff/login")
    assert response.status_code == 200
    assert "Staff Portal Sign In" in response.text
    assert 'action="/staff/login"' in response.text


def test_unauthenticated_staff_redirected_to_login():
    for path in ["/staff/dashboard", "/staff/complaints", "/staff/profile"]:
        response = client.get(path)
        assert response.status_code == 303
        assert response.headers["location"] == "/staff/login"


# ── Admin Unauthenticated Routes ───────────────────────────────────────────────

def test_admin_root_redirects_to_login():
    response = client.get("/admin/")
    assert response.status_code == 303
    assert response.headers["location"] == "/admin/login"


def test_admin_login_renders():
    response = client.get("/admin/login")
    assert response.status_code == 200
    assert "Admin Command Center" in response.text
    assert 'action="/admin/login"' in response.text


def test_unauthenticated_admin_redirected_to_login():
    for path in [
        "/admin/dashboard", "/admin/complaints", "/admin/staff",
        "/admin/citizens", "/admin/departments", "/admin/feedback",
        "/admin/audit-logs"
    ]:
        response = client.get(path)
        assert response.status_code == 303
        assert response.headers["location"] == "/admin/login"


# ── Static Assets ─────────────────────────────────────────────────────────────

def test_static_css_assets_serve():
    for css_file in ["citizen.css", "staff.css", "admin.css"]:
        response = client.get(f"/static/css/{css_file}")
        assert response.status_code == 200
        assert "var(--primary" in response.text
