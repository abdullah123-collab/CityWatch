"""
CityWatch Account Management Service

Provides safe provisioning and management of Administrator and Staff accounts.

SAFETY & SECURITY RULES:
  1. Passwords are validated for strength and hashed with bcrypt (cost factor 12).
  2. Plaintext passwords are NEVER stored, logged, or returned.
  3. Real accounts are written to dbo.Staff and dbo.Auth_Account ONLY when
     settings.db_enabled is True.
  4. When db_enabled is False, this module NEVER fabricates a false persistence
     claim, but clearly reports the database offline state and prerequisites.
  5. Admin and Staff roles are strictly separated. Public registration of Admin
     accounts is forbidden.
"""
from __future__ import annotations

import logging
import re
from typing import Any

from app.core.config import settings
from app.core.security import hash_password

logger = logging.getLogger(__name__)


def validate_password_strength(password: str) -> None:
    """Validate password meets minimum complexity requirements."""
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if not re.search(r"[A-Za-z]", password):
        raise ValueError("Password must contain at least one letter.")
    if not re.search(r"[0-9!@#$%^&*(),.?\":{}|<>\-_]", password):
        raise ValueError("Password must contain at least one number or special character.")


def validate_email_format(email: str) -> str:
    """Validate and normalize email address."""
    clean = email.strip().lower()
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean):
        raise ValueError("Invalid email format.")
    return clean


def create_admin_account_safe(
    full_name: str,
    email: str,
    phone: str,
    designation: str,
    password: str,
    dept_id: int | None = None,
) -> dict[str, Any]:
    """
    Safely create an Administrator account.

    If database access is configured and enabled:
      Persists the administrator in dbo.Staff and dbo.Auth_Account with role_name='Admin'.
    If database access is unavailable:
      Raises a descriptive RuntimeError explaining the offline state and prerequisites.
      Never claims mock data was saved to SQL Server.
    """
    full_name = full_name.strip()
    if not full_name:
        raise ValueError("Full name is required.")
    email = validate_email_format(email)
    phone = phone.strip()
    if not phone:
        raise ValueError("Phone number is required.")
    designation = designation.strip() or "System Administrator"
    validate_password_strength(password)

    pw_hash = hash_password(password)

    if not settings.db_enabled:
        raise RuntimeError(
            "Database access is currently disabled (DB_ENABLED=false). "
            "Real Admin accounts cannot be saved to SQL Server until database connection "
            "prerequisites are verified:\n"
            "  1. Verify Microsoft SQL Server is running and reachable.\n"
            "  2. Verify dedicated application login and credentials in .env.\n"
            "  3. Verify dbo.Staff, dbo.Department, and dbo.Auth_Account exist.\n"
            "  4. Set DB_ENABLED=true in .env.\n"
            "In the meantime, offline demonstration is available using the configured "
            "demo admin account (admin@citywatch.gov)."
        )

    # Database is enabled: write to real SQL Server tables
    from app.core import database as db
    from datetime import date

    # Ensure a valid department ID exists
    resolved_dept_id = dept_id
    if not resolved_dept_id:
        dept = db.fetchone("SELECT TOP 1 dept_id FROM dbo.Department ORDER BY dept_id")
        if dept:
            resolved_dept_id = dept["dept_id"]
        else:
            # Create a default Administration department
            with db.transaction() as cur:
                cur.execute(
                    """
                    INSERT INTO dbo.Department (dept_name, category, contact_email, head_officer)
                    OUTPUT INSERTED.dept_id
                    VALUES ('Executive Administration', 'Administration', ?, ?)
                    """,
                    (email, full_name),
                )
                resolved_dept_id = cur.fetchone()[0]

    with db.transaction() as cur:
        # Check for existing email in Staff
        cur.execute("SELECT staff_id FROM dbo.Staff WHERE LOWER(email) = ?", (email,))
        if cur.fetchone():
            raise ValueError(f"An account with email '{email}' already exists.")

        # Insert Staff row
        cur.execute(
            """
            INSERT INTO dbo.Staff (dept_id, full_name, designation, email, phone, joined_at, active_cases)
            OUTPUT INSERTED.staff_id
            VALUES (?, ?, ?, ?, ?, ?, 0)
            """,
            (resolved_dept_id, full_name, designation, email, phone, date.today().isoformat()),
        )
        staff_id = cur.fetchone()[0]

        # Insert Auth_Account with Admin role
        cur.execute(
            """
            INSERT INTO dbo.Auth_Account (account_type, staff_id, password_hash, role_name, is_active)
            OUTPUT INSERTED.account_id
            VALUES ('Staff', ?, ?, 'Admin', 1)
            """,
            (staff_id, pw_hash),
        )
        account_id = cur.fetchone()[0]

    try:
        db.execute(
            """
            INSERT INTO dbo.Audit_Log (table_name, action_type, record_id, action_details, action_by, action_at)
            VALUES ('Auth_Account', 'INSERT', ?, ?, 'Admin', CURRENT_TIMESTAMP)
            """,
            (account_id, f"Admin account provisioned: {email}"),
        )
    except Exception as exc:
        logger.warning("Audit write skipped: %s", exc)


    logger.info("Administrator account created in database for %s (staff_id=%s)", email, staff_id)
    return {
        "account_id": account_id,
        "staff_id": staff_id,
        "full_name": full_name,
        "email": email,
        "designation": designation,
        "role_name": "Admin",
        "dept_id": resolved_dept_id,
        "is_saved_in_db": True,
    }


def create_staff_account_safe(
    full_name: str,
    email: str,
    phone: str,
    designation: str,
    dept_id: int,
    password: str,
) -> dict[str, Any]:
    """
    Safely create a Field Staff account.

    If database access is configured and enabled:
      Persists the staff officer in dbo.Staff and dbo.Auth_Account with role_name='Staff'.
    If database access is unavailable:
      Raises a descriptive RuntimeError explaining the offline state and prerequisites.
    """
    full_name = full_name.strip()
    if not full_name:
        raise ValueError("Full name is required.")
    email = validate_email_format(email)
    phone = phone.strip()
    if not phone:
        raise ValueError("Phone number is required.")
    designation = designation.strip() or "Field Officer"
    validate_password_strength(password)

    if not settings.db_enabled:
        raise RuntimeError(
            "Database access is currently disabled (DB_ENABLED=false). "
            "Real Staff accounts cannot be saved to SQL Server until database connection "
            "prerequisites are verified:\n"
            "  1. Verify Microsoft SQL Server is running and reachable.\n"
            "  2. Verify dedicated application login and credentials in .env.\n"
            "  3. Verify dbo.Staff, dbo.Department, and dbo.Auth_Account exist.\n"
            "  4. Set DB_ENABLED=true in .env.\n"
            "In the meantime, offline demonstration is available using the configured "
            "demo staff accounts."
        )

    from app.repositories import admin_repository as ar
    created = ar.create_staff_account(
        full_name=full_name,
        email=email,
        phone=phone,
        designation=designation,
        dept_id=dept_id,
        role_name="Staff",
        password=password,
    )
    return {
        **created,
        "designation": designation,
        "role_name": "Staff",
        "dept_id": dept_id,
        "is_saved_in_db": True,
    }


def list_accounts_safe() -> dict[str, Any]:
    """
    List accounts safely without disclosing passwords or hashes.
    Reports database-backed accounts if connected, or demo configuration accounts if offline.
    """
    if settings.db_enabled:
        from app.core import database as db
        rows = db.fetchall(
            """
            SELECT
                a.account_id, a.account_type, a.role_name, a.is_active,
                s.staff_id, s.full_name, s.email, s.designation,
                d.dept_id, d.dept_name
            FROM dbo.Auth_Account AS a
            INNER JOIN dbo.Staff AS s ON s.staff_id = a.staff_id
            LEFT JOIN dbo.Department AS d ON d.dept_id = s.dept_id
            WHERE a.account_type = 'Staff'
            ORDER BY a.role_name, s.staff_id
            """
        )
        return {
            "source": "SQL Server Database (dbo.Auth_Account & dbo.Staff)",
            "db_enabled": True,
            "accounts": rows,
        }

    # Offline: report demo accounts with clear demo status
    from app.core.demo_accounts import DEMO_ADMIN_ACCOUNTS, DEMO_STAFF_ACCOUNTS
    demo_accounts = []
    for a in DEMO_ADMIN_ACCOUNTS:
        demo_accounts.append({
            "account_id": a["staff_id"],
            "staff_id": a["staff_id"],
            "full_name": a["full_name"],
            "email": a["email"],
            "designation": a["designation"],
            "dept_id": a["dept_id"],
            "dept_name": a["dept_name"],
            "role_name": a["role_name"],
            "is_active": a["is_active"],
            "source": "[Demo Account — Offline Development Only]",
        })
    for s in DEMO_STAFF_ACCOUNTS:
        demo_accounts.append({
            "account_id": s["staff_id"],
            "staff_id": s["staff_id"],
            "full_name": s["full_name"],
            "email": s["email"],
            "designation": s["designation"],
            "dept_id": s["dept_id"],
            "dept_name": s["dept_name"],
            "role_name": s["role_name"],
            "is_active": s["is_active"],
            "source": "[Demo Account — Offline Development Only]",
        })

    return {
        "source": "Local Demo Configuration (Offline — Not Saved in Database)",
        "db_enabled": False,
        "accounts": demo_accounts,
    }
