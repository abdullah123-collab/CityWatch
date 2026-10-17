"""
CityWatch Demo Accounts & Mock Configuration (Offline Development Only)

This module provides clearly labelled, development-only demo accounts and
departments for offline demonstration when database access is not enabled.

SECURITY RULES:
  1. Passwords are stored ONLY as salted bcrypt hashes, NEVER in plain text.
  2. Demo accounts are NEVER saved to SQL Server or presented as real DB records.
  3. Every authenticated demo user object has `is_demo = True` and
     `account_source = "demo_configuration"`.
"""
from __future__ import annotations

import copy
from typing import Any

from app.core.security import verify_password

# ── Demo Departments ───────────────────────────────────────────────────────────
DEMO_DEPARTMENTS: list[dict[str, Any]] = [
    {
        "dept_id": 1,
        "dept_name": "[Demo] Sanitation Department",
        "category": "Sanitation",
        "contact_email": "sanitation@citywatch.demo",
        "contact_phone": "042-111-222-01",
        "head_officer": "Dr. Tariq Mahmood",
    },
    {
        "dept_id": 2,
        "dept_name": "[Demo] Roads & Infrastructure",
        "category": "Roads",
        "contact_email": "roads@citywatch.demo",
        "contact_phone": "042-111-222-02",
        "head_officer": "Engr. Fatima Zahra",
    },
    {
        "dept_id": 3,
        "dept_name": "[Demo] Water Supply & Sewerage",
        "category": "Water",
        "contact_email": "water@citywatch.demo",
        "contact_phone": "042-111-222-03",
        "head_officer": "Ch. Naveed Anwar",
    },
    {
        "dept_id": 4,
        "dept_name": "[Demo] Electricity & Public Lighting",
        "category": "Electricity",
        "contact_email": "electricity@citywatch.demo",
        "contact_phone": "042-111-222-04",
        "head_officer": "Sardar Khalid Mehmood",
    },
]

# ── Pre-Computed Salted Bcrypt Hashes (Cost Factor 12) ─────────────────────────
# Generated via app.core.security.hash_password
# Demo Passwords (for offline testing only):
#   Staff:   StaffPass123!
#   Admin:   AdminPass123!
#   Citizen: Citizen123!
_DEMO_STAFF_HASH = "$2b$12$sWYX3F4fPbofWMG/rUzhnehWCDYPs0VCXsHfD80s6lePp3z4RDn9C"
_DEMO_ADMIN_HASH = "$2b$12$.T1Shr2Hh955V8P8Rl3fR.oWCgnP6Ax9.uuivkcQNrPON1v0VJssG"
_DEMO_CITIZEN_HASH = "$2b$12$QnQAdRyP2lwh/MVk0IZALO.YsXHtkBPXXZU9r7W2o/TtuxaPZ3f7K"


# ── Demo Staff Accounts ────────────────────────────────────────────────────────
DEMO_STAFF_ACCOUNTS: list[dict[str, Any]] = [
    {
        "staff_id": 1,
        "full_name": "Ahmed Khan (Demo Officer)",
        "email": "ahmed.staff@example.com",
        "designation": "Senior Sanitation Inspector",
        "dept_id": 1,
        "dept_name": "[Demo] Sanitation Department",
        "role_name": "Staff",
        "password_hash": _DEMO_STAFF_HASH,
        "active_cases": 2,
        "is_active": True,
        "is_demo": True,
    },
    {
        "staff_id": 2,
        "full_name": "Usman Tariq (Demo Officer)",
        "email": "usman.staff@example.com",
        "designation": "Roads Maintenance Engineer",
        "dept_id": 2,
        "dept_name": "[Demo] Roads & Infrastructure",
        "role_name": "Staff",
        "password_hash": _DEMO_STAFF_HASH,
        "active_cases": 1,
        "is_active": True,
        "is_demo": True,
    },
    {
        "staff_id": 3,
        "full_name": "Hassan Raza (Demo Officer)",
        "email": "hassan.staff@example.com",
        "designation": "Water Systems Inspector",
        "dept_id": 3,
        "dept_name": "[Demo] Water Supply & Sewerage",
        "role_name": "Staff",
        "password_hash": _DEMO_STAFF_HASH,
        "active_cases": 3,
        "is_active": True,
        "is_demo": True,
    },
    {
        "staff_id": 4,
        "full_name": "Bilal Farooq (Demo Officer)",
        "email": "bilal.staff@example.com",
        "designation": "Lighting Supervisor",
        "dept_id": 4,
        "dept_name": "[Demo] Electricity & Public Lighting",
        "role_name": "Staff",
        "password_hash": _DEMO_STAFF_HASH,
        "active_cases": 0,
        "is_active": True,
        "is_demo": True,
    },
]

# ── Demo Admin Accounts ────────────────────────────────────────────────────────
DEMO_ADMIN_ACCOUNTS: list[dict[str, Any]] = [
    {
        "staff_id": 100,
        "full_name": "Municipal Administrator (Demo)",
        "email": "admin@citywatch.gov",
        "designation": "Chief Administrative Officer",
        "dept_id": 1,
        "dept_name": "[Demo] Sanitation Department",
        "role_name": "Admin",
        "password_hash": _DEMO_ADMIN_HASH,
        "active_cases": 0,
        "is_active": True,
        "is_demo": True,
    },
]

# ── Demo Citizen Accounts ──────────────────────────────────────────────────────
DEMO_CITIZEN_ACCOUNTS: list[dict[str, Any]] = [
    {
        "citizen_id": 1,
        "full_name": "Ali Ahmed (Demo Citizen)",
        "email": "ali.ahmed@example.com",
        "phone": "03001234567",
        "address": "12-B Mall Road, Lahore",
        "role_name": "Citizen",
        "password_hash": _DEMO_CITIZEN_HASH,
        "is_active": True,
        "is_demo": True,
    },
]


# ── Public Lookups & Authentication ────────────────────────────────────────────

def get_demo_departments() -> list[dict[str, Any]]:
    """Return a deep copy of available demo departments."""
    return copy.deepcopy(DEMO_DEPARTMENTS)


def find_demo_staff(identifier: str) -> dict[str, Any] | None:
    """Find demo staff member by integer staff_id or email address."""
    clean = identifier.strip().lower()
    for s in DEMO_STAFF_ACCOUNTS:
        if str(s["staff_id"]) == clean or s["email"].lower() == clean:
            return s
    return None


def find_demo_admin(identifier: str) -> dict[str, Any] | None:
    """Find demo admin account by integer staff_id or email address."""
    clean = identifier.strip().lower()
    for a in DEMO_ADMIN_ACCOUNTS:
        if str(a["staff_id"]) == clean or a["email"].lower() == clean:
            return a
    return None


def find_demo_citizen(email: str) -> dict[str, Any] | None:
    """Find demo citizen account by email address."""
    clean = email.strip().lower()
    for c in DEMO_CITIZEN_ACCOUNTS:
        if c["email"].lower() == clean:
            return c
    return None


def authenticate_demo_staff(
    identifier: str,
    password: str,
    dept_id: int,
) -> dict[str, Any] | None:
    """
    Authenticate demo staff member.
    Validates:
      1. Staff ID or Email exists in demo accounts.
      2. Bcrypt password hash matches.
      3. Selected department strictly matches the staff member's assigned department.
    Returns safe user dict without password hash, or None on failure.
    """
    account = find_demo_staff(identifier)
    if not account:
        return None

    if not account.get("is_active", True):
        return None

    # Bcrypt verification
    if not verify_password(password, account["password_hash"]):
        return None

    # Department validation: staff member must belong to selected department
    if account["dept_id"] != int(dept_id):
        return None

    return {
        "account_id": account["staff_id"],
        "staff_id": account["staff_id"],
        "full_name": account["full_name"],
        "email": account["email"],
        "designation": account["designation"],
        "active_cases": account["active_cases"],
        "dept_id": account["dept_id"],
        "dept_name": account["dept_name"],
        "role_name": account["role_name"],
        "account_type": "Staff",
        "is_demo": True,
        "account_source": "demo_configuration",
    }


def authenticate_demo_admin(
    identifier: str,
    password: str,
) -> dict[str, Any] | None:
    """
    Authenticate demo admin account.
    Validates:
      1. Admin ID or Email exists in demo accounts.
      2. Bcrypt password hash matches.
      3. Account has 'Admin' role.
    Returns safe user dict without password hash, or None on failure.
    """
    account = find_demo_admin(identifier)
    if not account:
        return None

    if not account.get("is_active", True):
        return None

    if not verify_password(password, account["password_hash"]):
        return None

    if account.get("role_name") != "Admin":
        return None

    return {
        "account_id": account["staff_id"],
        "staff_id": account["staff_id"],
        "full_name": account["full_name"],
        "email": account["email"],
        "designation": account["designation"],
        "active_cases": account["active_cases"],
        "dept_id": account["dept_id"],
        "dept_name": account["dept_name"],
        "role_name": "Admin",
        "account_type": "Staff",
        "is_demo": True,
        "account_source": "demo_configuration",
    }


def authenticate_demo_citizen(
    email: str,
    password: str,
) -> dict[str, Any] | None:
    """
    Authenticate demo citizen account.
    Returns safe user dict without password hash, or None on failure.
    """
    account = find_demo_citizen(email)
    if not account:
        return None

    if not verify_password(password, account["password_hash"]):
        return None

    return {
        "account_id": account["citizen_id"],
        "citizen_id": account["citizen_id"],
        "full_name": account["full_name"],
        "email": account["email"],
        "phone": account["phone"],
        "address": account["address"],
        "role_name": "Citizen",
        "account_type": "Citizen",
        "is_demo": True,
        "account_source": "demo_configuration",
    }
