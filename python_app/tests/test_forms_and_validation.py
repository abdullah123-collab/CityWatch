"""
Tests for form submissions, field validation rules, and honest offline reporting.
"""
from urllib.parse import unquote

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.security import create_session_cookie

client = TestClient(app, follow_redirects=False)


# ── Registration Validation ───────────────────────────────────────────────────

def test_registration_rejects_password_mismatch():
    form_data = {
        "full_name": "Test Citizen",
        "email": "test@example.com",
        "phone": "+1 (555) 012-3456",
        "address": "123 Main St",
        "password": "Password123!",
        "confirm_password": "DifferentPassword123!",
    }
    response = client.post("/register", data=form_data)
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "Passwords do not match" in decoded_loc


def test_registration_rejects_short_password():
    form_data = {
        "full_name": "Test Citizen",
        "email": "test@example.com",
        "phone": "+1 (555) 012-3456",
        "address": "123 Main St",
        "password": "short",
        "confirm_password": "short",
    }
    response = client.post("/register", data=form_data)
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "at least 8 characters" in decoded_loc


def test_registration_rejects_invalid_phone():
    form_data = {
        "full_name": "Test Citizen",
        "email": "test@example.com",
        "phone": "abc-invalid",
        "address": "123 Main St",
        "password": "Password123!",
        "confirm_password": "Password123!",
    }
    response = client.post("/register", data=form_data)
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "valid phone number" in decoded_loc


def test_registration_honestly_reports_offline_db(monkeypatch):
    monkeypatch.setattr(settings, "db_enabled", False)
    form_data = {
        "full_name": "Valid Citizen",
        "email": "valid@example.com",
        "phone": "+1 (555) 012-3456",
        "address": "123 Main St",
        "password": "Password123!",
        "confirm_password": "Password123!",
    }
    response = client.post("/register", data=form_data)
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "Database not yet connected" in decoded_loc


# ── Login Honest Reporting ────────────────────────────────────────────────────

def test_citizen_login_honestly_reports_offline_db(monkeypatch):
    monkeypatch.setattr(settings, "db_enabled", False)
    monkeypatch.setattr(settings, "demo_mode", False)
    response = client.post("/login", data={"email": "c@example.com", "password": "pass"})
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "Database not yet connected" in decoded_loc



def test_staff_login_honestly_reports_offline_db(monkeypatch):
    monkeypatch.setattr(settings, "db_enabled", False)
    monkeypatch.setattr(settings, "demo_mode", False)
    response = client.post("/staff/login", data={"dept_id": "1", "email": "s@citywatch.gov", "password": "pass"})
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "Database not yet connected" in decoded_loc


def test_admin_login_honestly_reports_offline_db(monkeypatch):
    monkeypatch.setattr(settings, "db_enabled", False)
    monkeypatch.setattr(settings, "demo_mode", False)
    response = client.post("/admin/login", data={"email": "admin@citywatch.gov", "password": "pass"})
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "Database not yet connected" in decoded_loc



# ── Complaint Submission Validation ───────────────────────────────────────────

def test_complaint_submit_honestly_reports_offline_db(monkeypatch):
    monkeypatch.setattr(settings, "db_enabled", False)
    user = {
        "account_id": 1,
        "role_name": "Citizen",
        "citizen_id": 101,
        "full_name": "Sarah Connor",
    }
    client.cookies.set(settings.session_cookie_name, create_session_cookie(user))

    payload = {
        "dept_id": "1",
        "title": "Broken Streetlight",
        "category": "Electrical",
        "priority": "Medium",
        "description": "Streetlight at corner has been off for a week.",
        "area_name": "Sector 4",
        "city": "Metropolis",
        "district": "North",
        "pincode": "44000",
    }
    response = client.post("/complaints/new", data=payload)
    assert response.status_code == 303
    decoded_loc = unquote(response.headers["location"])
    assert "Database not yet connected" in decoded_loc

