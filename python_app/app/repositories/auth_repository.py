"""
Auth repository for CityWatch Python application.

Implements the same SQL queries as backend/src/services/authService.js,
using verified column names from Database/CityWatchTable.sql.

Tables used:
  dbo.Auth_Account (account_id, account_type, citizen_id, staff_id,
                    password_hash, role_name, is_active)
  dbo.Citizen      (citizen_id, full_name, email, phone, address)
  dbo.Staff        (staff_id, dept_id, full_name, designation, email, phone,
                    joined_at, active_cases)
  dbo.Department   (dept_id, dept_name, category)
  dbo.Auth_Session (session_id, account_id, token_hash, created_at,
                    expires_at, revoked_at)
  dbo.Audit_Log    (log_id, operation_type, table_name, record_id,
                    error_message, logged_at)
"""
from __future__ import annotations

import hashlib
import logging
from typing import Any

from app.core import database as db
from app.core.security import hash_password, verify_password

logger = logging.getLogger(__name__)


# ── Internal helpers ───────────────────────────────────────────────────────────

def _hash_token(token: str) -> bytes:
    """SHA-256 the session token for storage (mirrors Express implementation)."""
    return hashlib.sha256(token.encode("utf-8")).digest()


def _write_audit(op: str, table: str, record_id: int | None, msg: str, actor: str = "System") -> None:
    action_type = "INSERT"
    if op.upper() in ("UPDATE", "MODIFY", "STATUS_CHANGE"):
        action_type = "UPDATE"
    elif op.upper() in ("DELETE", "REMOVE"):
        action_type = "DELETE"
    elif op.upper() in ("INSERT", "REGISTER", "CREATE", "PROVISION"):
        action_type = "INSERT"
    else:
        return

    try:
        db.execute(
            """
            INSERT INTO dbo.Audit_Log (table_name, action_type, record_id, action_details, action_by, action_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (table, action_type, record_id, msg, actor),
        )
    except Exception as exc:
        logger.warning("Audit log write failed: %s", exc)




# ── Citizen auth ───────────────────────────────────────────────────────────────

def register_citizen(
    full_name: str,
    email: str,
    phone: str,
    address: str | None,
    password: str,
) -> dict[str, Any]:
    """
    Register a new citizen and create an Auth_Account row.
    Mirrors authService.registerCitizen.
    Returns the public user dict (no password hash).
    """
    pw_hash = hash_password(password)

    with db.transaction() as cur:
        # Insert Citizen
        cur.execute(
            """
            INSERT INTO dbo.Citizen (full_name, email, phone, address)
            OUTPUT INSERTED.citizen_id
            VALUES (?, ?, ?, ?)
            """,
            (full_name, email, phone, address),
        )
        row = cur.fetchone()
        citizen_id = row[0]

        # Insert Auth_Account
        cur.execute(
            """
            INSERT INTO dbo.Auth_Account (account_type, citizen_id, password_hash, role_name, is_active)
            OUTPUT INSERTED.account_id
            VALUES ('Citizen', ?, ?, 'Citizen', 1)
            """,
            (citizen_id, pw_hash),
        )
        row = cur.fetchone()
        account_id = row[0]

    _write_audit("REGISTER", "Citizen", citizen_id, f"Citizen registered: {email}")

    return {
        "citizen_id": citizen_id,
        "full_name": full_name,
        "email": email,
        "phone": phone,
        "address": address,
        "role_name": "Citizen",
        "account_type": "Citizen",
    }


def login_citizen(email: str, password: str) -> dict[str, Any] | None:
    """
    Verify citizen credentials.
    Returns the user dict on success, None if credentials invalid.
    Raises ValueError for account-level errors (deactivated, no password).
    """
    row = db.fetchone(
        """
        SELECT TOP 1
            a.account_id, a.password_hash, a.is_active,
            c.citizen_id, c.full_name, c.email, c.phone, c.address
        FROM dbo.Auth_Account AS a
        INNER JOIN dbo.Citizen AS c ON c.citizen_id = a.citizen_id
        WHERE c.email = ? AND a.account_type = 'Citizen'
        """,
        (email.strip().lower(),),
    )
    if not row:
        return None

    if not row["is_active"]:
        raise ValueError("This account has been deactivated. Please contact support.")

    if not row["password_hash"]:
        raise ValueError(
            "This account has no password set. Use the registration flow to create one."
        )

    if not verify_password(password, row["password_hash"]):
        return None

    _write_audit("LOGIN", "Auth_Account", row["account_id"], f"Citizen login: {email}")

    return {
        "account_id": row["account_id"],
        "citizen_id": row["citizen_id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "phone": row["phone"],
        "address": row["address"],
        "role_name": "Citizen",
        "account_type": "Citizen",
    }


# ── Staff auth ─────────────────────────────────────────────────────────────────

def login_staff(
    identifier: str,
    password: str,
    dept_id: int | None = None,
) -> dict[str, Any] | None:
    """
    Verify staff/admin credentials against SQL Server.
    Supports Staff ID (numeric) or Email identifier.
    Optionally validates that the staff member belongs to dept_id.
    Returns user dict on success, None on invalid credentials or department mismatch.
    """
    clean_id = identifier.strip()
    is_numeric = clean_id.isdigit()

    if is_numeric:
        row = db.fetchone(
            """
            SELECT TOP 1
                a.account_id, a.password_hash, a.role_name, a.is_active,
                s.staff_id, s.full_name, s.email, s.designation, s.active_cases,
                d.dept_id, d.dept_name
            FROM dbo.Auth_Account AS a
            INNER JOIN dbo.Staff AS s ON s.staff_id = a.staff_id
            LEFT JOIN dbo.Department AS d ON d.dept_id = s.dept_id
            WHERE (s.staff_id = ? OR LOWER(s.email) = ?) AND a.account_type = 'Staff'
            """,
            (int(clean_id), clean_id.lower()),
        )
    else:
        row = db.fetchone(
            """
            SELECT TOP 1
                a.account_id, a.password_hash, a.role_name, a.is_active,
                s.staff_id, s.full_name, s.email, s.designation, s.active_cases,
                d.dept_id, d.dept_name
            FROM dbo.Auth_Account AS a
            INNER JOIN dbo.Staff AS s ON s.staff_id = a.staff_id
            LEFT JOIN dbo.Department AS d ON d.dept_id = s.dept_id
            WHERE LOWER(s.email) = ? AND a.account_type = 'Staff'
            """,
            (clean_id.lower(),),
        )

    if not row:
        return None

    if not row.get("is_active"):
        return None

    if not row.get("password_hash"):
        return None

    if not verify_password(password, row["password_hash"]):
        return None

    # Department validation: verify staff belongs to selected department
    if dept_id is not None:
        if row.get("dept_id") != int(dept_id):
            return None

    _write_audit(
        "LOGIN", "Staff", row["staff_id"],
        f"Staff login: {clean_id} ({row['role_name']})"
    )

    return {
        "account_id": row["account_id"],
        "staff_id": row["staff_id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "designation": row["designation"],
        "active_cases": row["active_cases"],
        "dept_id": row["dept_id"],
        "dept_name": row["dept_name"],
        "role_name": row["role_name"],
        "account_type": "Staff",
        "is_demo": False,
        "account_source": "sql_server",
    }



# ── Token / session lookup (for SQL-backed sessions) ──────────────────────────

def get_user_from_token(token: str) -> dict[str, Any] | None:
    """
    Look up the session token in Auth_Session and return the full user dict.
    This mirrors the Express getUserFromToken function.
    Used only when db_enabled=true (SQL-backed sessions).
    """
    token_hash = _hash_token(token)
    row = db.fetchone(
        """
        SELECT
            sess.account_id, acc.role_name, acc.account_type, acc.is_active,
            acc.citizen_id, acc.staff_id
        FROM dbo.Auth_Session AS sess
        INNER JOIN dbo.Auth_Account AS acc ON acc.account_id = sess.account_id
        WHERE sess.token_hash = ?
          AND sess.revoked_at IS NULL
          AND sess.expires_at > CURRENT_TIMESTAMP
        """,
        (token_hash,),
    )
    if not row or not row["is_active"]:
        return None

    if row["account_type"] == "Citizen":
        citizen = db.fetchone(
            "SELECT citizen_id, full_name, email, phone, address FROM dbo.Citizen WHERE citizen_id = ?",
            (row["citizen_id"],),
        )
        if not citizen:
            return None
        return {
            "account_id": row["account_id"],
            "citizen_id": citizen["citizen_id"],
            "full_name": citizen["full_name"],
            "email": citizen["email"],
            "phone": citizen["phone"],
            "address": citizen["address"],
            "role_name": row["role_name"],
            "account_type": "Citizen",
        }
    else:
        staff = db.fetchone(
            """
            SELECT s.staff_id, s.full_name, s.email, s.designation, s.active_cases,
                   d.dept_id, d.dept_name
            FROM dbo.Staff AS s
            LEFT JOIN dbo.Department AS d ON d.dept_id = s.dept_id
            WHERE s.staff_id = ?
            """,
            (row["staff_id"],),
        )
        if not staff:
            return None
        return {
            "account_id": row["account_id"],
            "staff_id": staff["staff_id"],
            "full_name": staff["full_name"],
            "email": staff["email"],
            "designation": staff["designation"],
            "active_cases": staff["active_cases"],
            "dept_id": staff["dept_id"],
            "dept_name": staff["dept_name"],
            "role_name": row["role_name"],
            "account_type": "Staff",
        }
