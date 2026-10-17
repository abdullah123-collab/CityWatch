"""
Tests for authenticated page rendering across Citizen, Staff, and Admin portals.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.security import create_session_cookie

client = TestClient(app, follow_redirects=False)


# ── Citizen Authenticated Pages ───────────────────────────────────────────────

def test_authenticated_citizen_dashboard_renders():
    user = {
        "account_id": 1,
        "role_name": "Citizen",
        "citizen_id": 101,
        "full_name": "Sarah Connor",
        "email": "sarah@example.com",
    }
    client.cookies.set(settings.session_cookie_name, create_session_cookie(user))

    response = client.get("/dashboard")
    assert response.status_code == 200
    assert "Sarah Connor" in response.text
    assert "Citizen Dashboard" in response.text


def test_authenticated_citizen_complaint_history_renders():
    user = {
        "account_id": 1,
        "role_name": "Citizen",
        "citizen_id": 101,
        "full_name": "Sarah Connor",
    }
    client.cookies.set(settings.session_cookie_name, create_session_cookie(user))

    response = client.get("/complaints")
    assert response.status_code == 200
    assert "My Complaints History" in response.text


def test_authenticated_citizen_new_complaint_form_renders():
    user = {
        "account_id": 1,
        "role_name": "Citizen",
        "citizen_id": 101,
        "full_name": "Sarah Connor",
    }
    client.cookies.set(settings.session_cookie_name, create_session_cookie(user))

    response = client.get("/complaints/new")
    assert response.status_code == 200
    assert "Report a Municipal Issue" in response.text
    assert "Incident Location (Manual Address)" in response.text
    assert 'name="area_name"' in response.text
    assert 'name="city"' in response.text
    assert 'name="district"' in response.text
    assert 'name="pincode"' in response.text


def test_authenticated_citizen_profile_renders():
    user = {
        "account_id": 1,
        "role_name": "Citizen",
        "citizen_id": 101,
        "full_name": "Sarah Connor",
        "email": "sarah@example.com",
        "phone": "+1 (555) 019-2834",
        "address": "42 Market Street",
    }
    client.cookies.set(settings.session_cookie_name, create_session_cookie(user))

    response = client.get("/profile")
    assert response.status_code == 200
    assert "Sarah Connor" in response.text
    assert "sarah@example.com" in response.text
    assert "+1 (555) 019-2834" in response.text


# ── Staff Authenticated Pages ─────────────────────────────────────────────────

def test_authenticated_staff_dashboard_renders():
    user = {
        "account_id": 2,
        "role_name": "Staff",
        "staff_id": 5,
        "full_name": "Officer Alex Murphy",
        "designation": "Lead Inspector",
        "dept_name": "Public Works",
        "active_cases": 2,
    }
    client.cookies.set(settings.session_cookie_name, create_session_cookie(user))

    response = client.get("/staff/dashboard")
    assert response.status_code == 200
    assert "Officer Alex Murphy" in response.text
    assert "Officer Case Management" in response.text


def test_authenticated_staff_complaints_list_renders():
    user = {
        "account_id": 2,
        "role_name": "Staff",
        "staff_id": 5,
        "full_name": "Officer Alex Murphy",
    }
    client.cookies.set(settings.session_cookie_name, create_session_cookie(user))

    response = client.get("/staff/complaints")
    assert response.status_code == 200
    assert "All Assigned Complaints" in response.text


def test_authenticated_staff_profile_renders():
    user = {
        "account_id": 2,
        "role_name": "Staff",
        "staff_id": 5,
        "full_name": "Officer Alex Murphy",
        "email": "amurphy@citywatch.gov",
        "phone": "+1 (555) 018-9999",
        "designation": "Lead Inspector",
        "dept_name": "Public Works",
        "active_cases": 2,
    }
    client.cookies.set(settings.session_cookie_name, create_session_cookie(user))

    response = client.get("/staff/profile")
    assert response.status_code == 200
    assert "Officer Alex Murphy" in response.text
    assert "amurphy@citywatch.gov" in response.text


# ── Admin Authenticated Pages ─────────────────────────────────────────────────

def test_authenticated_admin_pages_render():
    admin_user = {
        "account_id": 3,
        "role_name": "Admin",
        "full_name": "City Administrator",
        "email": "admin@citywatch.gov",
    }
    client.cookies.set(settings.session_cookie_name, create_session_cookie(admin_user))

    endpoints = [
        ("/admin/dashboard", "CityWatch Command Dashboard"),
        ("/admin/complaints", "City-Wide Complaints Registry"),
        ("/admin/staff", "Active Officer Directory"),
        ("/admin/citizens", "Registered Citizens"),
        ("/admin/departments", "Municipal Departments"),
        ("/admin/feedback", "Citizen Resolution Feedback"),
        ("/admin/audit-logs", "Immutable Audit Logs"),
    ]

    for path, expected_text in endpoints:
        response = client.get(path)
        assert response.status_code == 200, f"Failed for {path}"
        assert expected_text in response.text, f"Expected '{expected_text}' in {path}"
