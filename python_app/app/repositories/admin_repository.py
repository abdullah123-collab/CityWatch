"""
Admin repository for CityWatch Python application.
SQL queries verified against Database/CityWatchTable.sql.
"""
from __future__ import annotations

import logging
from typing import Any

import bcrypt as _bcrypt

from app.core import database as db
from app.core.security import hash_password

logger = logging.getLogger(__name__)


def _write_audit(op: str, table: str, record_id: int | None, msg: str, actor: str = "Admin") -> None:
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
        logger.warning("Audit write failed: %s", exc)




def get_admin_dashboard() -> dict[str, Any]:
    comp = db.fetchone(
        """
        SELECT
            COUNT(*) AS total_complaints,
            SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
            SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected
        FROM dbo.Complaint
        """
    ) or {}

    citizens = db.fetchone("SELECT COUNT(*) AS total FROM dbo.Citizen") or {}
    staff_count = db.fetchone(
        "SELECT COUNT(*) AS total FROM dbo.Staff WHERE email <> 'admin@citywatch.gov'"
    ) or {}

    dept_stats = db.fetchall(
        """
        SELECT
            d.dept_id, d.dept_name, d.category,
            COUNT(c.complaint_id) AS complaint_count,
            SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_count
        FROM dbo.Department AS d
        LEFT JOIN dbo.Complaint AS c ON c.dept_id = d.dept_id
        GROUP BY d.dept_id, d.dept_name, d.category
        ORDER BY complaint_count DESC
        """
    )

    staff_workload = db.fetchall(
        """
        SELECT
            s.staff_id, s.full_name, s.designation, s.active_cases,
            d.dept_name,
            a.is_active
        FROM dbo.Staff AS s
        INNER JOIN dbo.Department AS d ON d.dept_id = s.dept_id
        LEFT JOIN dbo.Auth_Account AS a ON a.staff_id = s.staff_id
        WHERE s.email <> 'admin@citywatch.gov'
        ORDER BY s.active_cases DESC
        """
    )

    fb = db.fetchone(
        """
        SELECT COUNT(*) AS total_reviews, AVG(CAST(rating AS FLOAT)) AS avg_rating
        FROM dbo.Feedback
        """
    ) or {}

    return {
        "metrics": {
            "totalComplaints": comp.get("total_complaints", 0) or 0,
            "pendingComplaints": comp.get("pending", 0) or 0,
            "inProgressComplaints": comp.get("in_progress", 0) or 0,
            "resolvedComplaints": comp.get("resolved", 0) or 0,
            "rejectedComplaints": comp.get("rejected", 0) or 0,
            "totalCitizens": citizens.get("total", 0) or 0,
            "totalStaff": staff_count.get("total", 0) or 0,
            "averageRating": round(float(fb["avg_rating"]), 2) if fb.get("avg_rating") else None,
            "totalReviews": fb.get("total_reviews", 0) or 0,
        },
        "departmentStats": dept_stats,
        "staffWorkload": staff_workload,
    }


def get_all_staff() -> list[dict]:
    return db.fetchall(
        """
        SELECT
            s.staff_id, s.full_name, s.designation, s.email, s.phone,
            s.active_cases, s.joined_at,
            d.dept_id, d.dept_name,
            a.role_name, a.is_active
        FROM dbo.Staff AS s
        INNER JOIN dbo.Department AS d ON d.dept_id = s.dept_id
        LEFT JOIN dbo.Auth_Account AS a ON a.staff_id = s.staff_id
        WHERE s.email <> 'admin@citywatch.gov'
        ORDER BY s.full_name
        """
    )


def get_staff_member(staff_id: int) -> dict | None:
    return db.fetchone(
        """
        SELECT
            s.staff_id, s.full_name, s.designation, s.email, s.phone,
            s.active_cases, s.joined_at,
            d.dept_id, d.dept_name,
            a.role_name, a.is_active
        FROM dbo.Staff AS s
        INNER JOIN dbo.Department AS d ON d.dept_id = s.dept_id
        LEFT JOIN dbo.Auth_Account AS a ON a.staff_id = s.staff_id
        WHERE s.staff_id = ?
        """,
        (staff_id,),
    )


def get_staff_dashboard(staff_id: int) -> dict[str, Any]:
    staff = db.fetchone(
        """
        SELECT s.staff_id, s.full_name, s.designation, s.active_cases, d.dept_name
        FROM dbo.Staff AS s
        INNER JOIN dbo.Department AS d ON d.dept_id = s.dept_id
        WHERE s.staff_id = ?
        """,
        (staff_id,),
    )
    if not staff:
        raise ValueError("Staff member not found.")

    counts = db.fetchone(
        """
        SELECT
            COUNT(*) AS total_assigned,
            SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
            SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_count,
            SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_count,
            SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected_count
        FROM dbo.Complaint
        WHERE staff_id = ?
        """,
        (staff_id,),
    ) or {}

    return {
        "staff": staff,
        "workload": {
            "activeCases": staff["active_cases"],
            "maxCapacity": 5,
            "utilizationPercentage": round((staff["active_cases"] / 5) * 100),
        },
        "counts": {
            "total": counts.get("total_assigned", 0) or 0,
            "pending": counts.get("pending_count", 0) or 0,
            "inProgress": counts.get("in_progress_count", 0) or 0,
            "resolved": counts.get("resolved_count", 0) or 0,
            "rejected": counts.get("rejected_count", 0) or 0,
        },
    }


def create_staff_account(
    full_name: str,
    email: str,
    phone: str,
    designation: str,
    dept_id: int,
    role_name: str,
    password: str,
) -> dict:
    from datetime import date

    pw_hash = hash_password(password)

    with db.transaction() as cur:
        cur.execute(
            """
            INSERT INTO dbo.Staff (dept_id, full_name, designation, email, phone, joined_at, active_cases)
            OUTPUT INSERTED.staff_id
            VALUES (?, ?, ?, ?, ?, ?, 0)
            """,
            (dept_id, full_name, designation, email, phone, date.today().isoformat()),
        )
        staff_id = cur.fetchone()[0]

        cur.execute(
            """
            INSERT INTO dbo.Auth_Account (account_type, staff_id, password_hash, role_name, is_active)
            VALUES ('Staff', ?, ?, ?, 1)
            """,
            (staff_id, pw_hash, role_name),
        )

    _write_audit("INSERT", "Staff", staff_id, f"Staff account created: {email}")
    return {"staff_id": staff_id, "full_name": full_name, "email": email}


def set_staff_active_status(staff_id: int, is_active: bool) -> dict:
    db.execute(
        "UPDATE dbo.Auth_Account SET is_active = ? WHERE staff_id = ?",
        (1 if is_active else 0, staff_id),
    )
    return {"staff_id": staff_id, "is_active": is_active}


def get_all_citizens() -> list[dict]:
    return db.fetchall(
        """
        SELECT
            c.citizen_id, c.full_name, c.email, c.phone, c.address, c.registered_at,
            COUNT(comp.complaint_id) AS complaint_count
        FROM dbo.Citizen AS c
        LEFT JOIN dbo.Complaint AS comp ON comp.citizen_id = c.citizen_id
        GROUP BY c.citizen_id, c.full_name, c.email, c.phone, c.address, c.registered_at
        ORDER BY c.registered_at DESC
        """
    )


def get_all_departments() -> list[dict]:
    return db.fetchall(
        "SELECT dept_id, dept_name, category, contact_email, contact_phone, head_officer "
        "FROM dbo.Department ORDER BY dept_name"
    )


def create_department(
    dept_name: str,
    category: str,
    contact_email: str | None,
    contact_phone: str | None,
    head_officer: str | None,
) -> dict:
    with db.transaction() as cur:
        cur.execute(
            """
            INSERT INTO dbo.Department (dept_name, category, contact_email, contact_phone, head_officer)
            OUTPUT INSERTED.dept_id
            VALUES (?, ?, ?, ?, ?)
            """,
            (dept_name, category, contact_email, contact_phone, head_officer),
        )
        dept_id = cur.fetchone()[0]
    return {"dept_id": dept_id, "dept_name": dept_name}


def get_all_feedback() -> list[dict]:
    return db.fetchall(
        """
        SELECT
            f.feedback_id, f.rating, f.comments, f.submitted_at,
            c.complaint_id, c.title AS complaint_title,
            cit.full_name AS citizen_name
        FROM dbo.Feedback AS f
        INNER JOIN dbo.Complaint AS c ON c.complaint_id = f.complaint_id
        INNER JOIN dbo.Citizen AS cit ON cit.citizen_id = f.citizen_id
        ORDER BY f.submitted_at DESC
        """
    )


def get_audit_logs(limit: int = 200) -> list[dict]:
    return db.fetchall(
        f"""
        SELECT TOP {limit}
            audit_id AS log_id,
            action_type AS operation_type,
            table_name,
            record_id,
            action_details AS error_message,
            action_by,
            action_at AS logged_at
        FROM dbo.Audit_Log
        ORDER BY action_at DESC
        """
    )

