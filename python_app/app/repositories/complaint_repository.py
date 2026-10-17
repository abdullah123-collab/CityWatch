"""
Complaint repository for CityWatch Python application.

SQL queries verified against Database/CityWatchTable.sql column names.
"""
from __future__ import annotations

import logging
from typing import Any

from app.core import database as db

logger = logging.getLogger(__name__)

VALID_STATUSES = ("Pending", "In Progress", "Resolved", "Rejected")
VALID_PRIORITIES = ("Low", "Medium", "High", "Critical")

ALLOWED_TRANSITIONS: dict[str, list[str]] = {
    "Pending": ["In Progress", "Rejected"],
    "In Progress": ["Resolved", "Rejected"],
    "Resolved": [],
    "Rejected": [],
}


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
        logger.warning("Audit write failed: %s", exc)




# ── Citizen complaint queries ──────────────────────────────────────────────────

def get_complaints_for_citizen(
    citizen_id: int,
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
    sort: str = "newest",
) -> list[dict[str, Any]]:
    direction = "ASC" if sort == "oldest" else "DESC"
    rows = db.fetchall(
        f"""
        SELECT
            c.complaint_id, c.title, c.description, c.category, c.priority,
            c.status, c.submitted_at, c.resolved_at,
            d.dept_name AS department,
            s.full_name AS assigned_staff,
            l.area_name, l.city, l.district, l.pincode,
            (SELECT COUNT(*) FROM dbo.Complaint_Attachment WHERE complaint_id = c.complaint_id)
                AS attachment_count
        FROM dbo.Complaint AS c
        INNER JOIN dbo.Department AS d ON d.dept_id = c.dept_id
        INNER JOIN dbo.Location AS l ON l.location_id = c.location_id
        LEFT JOIN dbo.Staff AS s ON s.staff_id = c.staff_id
        WHERE c.citizen_id = ?
          AND (? IS NULL OR c.title LIKE ? OR c.description LIKE ?)
          AND (? IS NULL OR c.status = ?)
          AND (? IS NULL OR c.priority = ?)
        ORDER BY c.submitted_at {direction}
        """,
        (
            citizen_id,
            f"%{search}%" if search else None,
            f"%{search}%" if search else None,
            f"%{search}%" if search else None,
            status if status and status != "All" else None,
            status if status and status != "All" else None,
            priority if priority and priority != "All" else None,
            priority if priority and priority != "All" else None,
        ),
    )
    return rows


def get_complaint_details(complaint_id: int, user: dict) -> dict[str, Any]:
    """
    Fetch full complaint data including location, history, attachments, and feedback.
    Enforces ownership: citizens may only see their own complaints.
    Staff may only see complaints assigned to them; admins see all.
    """
    row = db.fetchone(
        """
        SELECT
            c.complaint_id, c.title, c.description, c.category, c.priority,
            c.status, c.submitted_at, c.resolved_at,
            cit.citizen_id, cit.full_name AS citizen_name,
            cit.email AS citizen_email, cit.phone AS citizen_phone,
            d.dept_id, d.dept_name AS department,
            s.staff_id, s.full_name AS assigned_staff,
            l.area_name, l.city, l.district, l.pincode, l.latitude, l.longitude,
            loc.location_id
        FROM dbo.Complaint AS c
        INNER JOIN dbo.Citizen AS cit ON cit.citizen_id = c.citizen_id
        INNER JOIN dbo.Department AS d ON d.dept_id = c.dept_id
        INNER JOIN dbo.Location AS l ON l.location_id = c.location_id
        LEFT JOIN dbo.Staff AS s ON s.staff_id = c.staff_id
        INNER JOIN dbo.Location AS loc ON loc.location_id = c.location_id
        WHERE c.complaint_id = ?
        """,
        (complaint_id,),
    )
    if not row:
        raise ValueError(f"Complaint #{complaint_id} not found.")

    role = user.get("role_name")
    if role == "Citizen" and row["citizen_id"] != user.get("citizen_id"):
        raise PermissionError("You do not have permission to view this complaint.")
    if role == "Staff" and row.get("staff_id") != user.get("staff_id"):
        raise PermissionError("This complaint is not assigned to you.")

    # History
    history = db.fetchall(
        """
        SELECT h.history_id, h.old_status, h.new_status, h.remarks, h.changed_at,
               s.full_name AS staff_name, s.designation AS staff_designation
        FROM dbo.Complaint_History AS h
        LEFT JOIN dbo.Staff AS s ON s.staff_id = h.staff_id
        WHERE h.complaint_id = ?
        ORDER BY h.changed_at ASC
        """,
        (complaint_id,),
    )

    # Attachments
    attachments = db.fetchall(
        """
        SELECT attachment_id, file_name, file_path, mime_type, file_size, uploaded_at
        FROM dbo.Complaint_Attachment
        WHERE complaint_id = ?
        ORDER BY uploaded_at ASC
        """,
        (complaint_id,),
    )

    # Feedback
    feedback = db.fetchall(
        """
        SELECT feedback_id, rating, comments, submitted_at
        FROM dbo.Feedback
        WHERE complaint_id = ?
        ORDER BY submitted_at DESC
        """,
        (complaint_id,),
    )

    # For staff: only show citizen phone if this complaint is assigned to them
    complaint = dict(row)
    if role == "Citizen":
        complaint.pop("citizen_phone", None)

    return {
        "complaint": complaint,
        "history": history,
        "attachments": attachments,
        "feedback": feedback,
    }


def create_complaint(
    citizen_id: int,
    dept_id: int,
    title: str,
    description: str,
    category: str,
    priority: str,
    location: dict,
    file_paths: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Create a complaint with Location, Complaint, optional attachments, and
    initial Complaint_History row – all in one transaction.
    Mirrors Express complaintService.createComplaint.
    """
    # Validate priority
    if priority not in VALID_PRIORITIES:
        raise ValueError(f"Priority must be one of: {', '.join(VALID_PRIORITIES)}.")

    # Check duplicate (within 30 seconds)
    dup = db.fetchone(
        """
        SELECT TOP 1 complaint_id
        FROM dbo.Complaint
        WHERE citizen_id = ? AND title = ?
          AND submitted_at > DATEADD(SECOND, -30, CURRENT_TIMESTAMP)
        """,
        (citizen_id, title),
    )
    if dup:
        raise ValueError(
            f"An identical complaint was already submitted (#{dup['complaint_id']}). "
            "Please avoid submitting the same report twice."
        )

    with db.transaction() as cur:
        # 1. Insert Location
        cur.execute(
            """
            INSERT INTO dbo.Location (area_name, city, district, pincode, latitude, longitude)
            OUTPUT INSERTED.location_id
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                (location.get("areaName") or location.get("area_name") or "")[:100],
                (location.get("city") or "")[:80],
                (location.get("district") or "")[:80],
                (location.get("pincode") or "")[:10],
                location.get("latitude"),
                location.get("longitude"),
            ),
        )
        location_id = cur.fetchone()[0]

        # 2. Insert Complaint
        cur.execute(
            """
            INSERT INTO dbo.Complaint
              (citizen_id, dept_id, location_id, title, description, category, priority, status, submitted_at)
            OUTPUT INSERTED.complaint_id
            VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', CURRENT_TIMESTAMP)
            """,
            (citizen_id, dept_id, location_id, title[:200], description, category[:80], priority),
        )
        complaint_id = cur.fetchone()[0]

        # 3. Initial history entry
        cur.execute(
            """
            INSERT INTO dbo.Complaint_History
              (complaint_id, staff_id, old_status, new_status, remarks, changed_at)
            VALUES (?, NULL, 'New', 'Pending', 'Complaint submitted by citizen.', CURRENT_TIMESTAMP)
            """,
            (complaint_id,),
        )

        # 4. Attachments (if any)
        if file_paths:
            from pathlib import Path
            for fp in file_paths:
                stored = fp.get("stored_name") or Path(fp.get("file_path", "")).name or fp.get("file_name", "upload")
                cur.execute(
                    """
                    INSERT INTO dbo.Complaint_Attachment
                      (complaint_id, file_name, stored_name, file_path, file_size, mime_type, uploaded_at)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                    """,
                    (
                        complaint_id,
                        fp["file_name"],
                        stored,
                        fp["file_path"],
                        fp["file_size"],
                        fp["mime_type"],
                    ),
                )


    _write_audit("INSERT", "Complaint", complaint_id,
                 f"Citizen #{citizen_id} submitted complaint #{complaint_id}")

    return {"complaint_id": complaint_id}


def add_feedback(complaint_id: int, citizen_id: int, rating: int, comments: str | None) -> dict:
    """Add citizen feedback for a resolved complaint."""
    if not (1 <= rating <= 5):
        raise ValueError("Rating must be between 1 and 5.")

    with db.transaction() as cur:
        cur.execute(
            """
            INSERT INTO dbo.Feedback (complaint_id, citizen_id, rating, comments, submitted_at)
            OUTPUT INSERTED.feedback_id
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (complaint_id, citizen_id, rating, comments),
        )
        feedback_id = cur.fetchone()[0]

    return {"feedback_id": feedback_id, "rating": rating}


def get_attachment_meta(complaint_id: int, attachment_id: int) -> dict | None:
    return db.fetchone(
        """
        SELECT attachment_id, file_name, file_path, mime_type, file_size
        FROM dbo.Complaint_Attachment
        WHERE complaint_id = ? AND attachment_id = ?
        """,
        (complaint_id, attachment_id),
    )


# ── Staff complaint queries ────────────────────────────────────────────────────

def get_assigned_complaints(
    staff_id: int,
    search: str | None = None,
    status: str | None = None,
    priority: str | None = None,
) -> list[dict]:
    return db.fetchall(
        """
        SELECT
            c.complaint_id, c.title, c.description, c.category, c.priority,
            c.status, c.submitted_at, c.resolved_at,
            d.dept_name AS department,
            cit.full_name AS citizen_name, cit.email AS citizen_email, cit.phone AS citizen_phone,
            l.area_name, l.city, l.district, l.pincode, l.latitude, l.longitude,
            (SELECT COUNT(*) FROM dbo.Complaint_Attachment WHERE complaint_id = c.complaint_id)
                AS attachment_count
        FROM dbo.Complaint AS c
        INNER JOIN dbo.Department AS d ON d.dept_id = c.dept_id
        INNER JOIN dbo.Citizen AS cit ON cit.citizen_id = c.citizen_id
        INNER JOIN dbo.Location AS l ON l.location_id = c.location_id
        WHERE c.staff_id = ?
          AND (? IS NULL OR c.title LIKE ? OR c.description LIKE ? OR cit.full_name LIKE ?)
          AND (? IS NULL OR c.status = ?)
          AND (? IS NULL OR c.priority = ?)
        ORDER BY c.submitted_at DESC
        """,
        (
            staff_id,
            f"%{search}%" if search else None,
            f"%{search}%" if search else None,
            f"%{search}%" if search else None,
            f"%{search}%" if search else None,
            status if status and status != "All" else None,
            status if status and status != "All" else None,
            priority if priority and priority != "All" else None,
            priority if priority and priority != "All" else None,
        ),
    )


def update_complaint_status(
    staff_id: int,
    complaint_id: int,
    new_status: str,
    remarks: str,
    actor_role: str = "Staff",
) -> dict:
    """
    Update complaint status with transition validation and active_cases bookkeeping.
    Mirrors staffService.updateComplaintStatus.
    """
    if new_status not in VALID_STATUSES:
        raise ValueError(f"Invalid status '{new_status}'. Allowed: {', '.join(VALID_STATUSES)}.")

    trimmed_remarks = remarks.strip()
    if not trimmed_remarks:
        raise ValueError("Remarks are required when updating a complaint status.")
    if len(trimmed_remarks) > 2000:
        raise ValueError("Remarks must be 2000 characters or fewer.")

    row = db.fetchone(
        "SELECT complaint_id, status FROM dbo.Complaint WHERE complaint_id = ? AND staff_id = ?",
        (complaint_id, staff_id),
    )
    if not row:
        raise PermissionError("Complaint is not assigned to this staff member or does not exist.")

    old_status = row["status"]
    if old_status == new_status:
        raise ValueError(f"Complaint is already \"{old_status}\". Choose a different status.")

    is_closing = new_status in ("Resolved", "Rejected")
    was_closing = old_status in ("Resolved", "Rejected")
    is_reopen = was_closing and not is_closing

    if is_reopen and actor_role != "Admin":
        raise PermissionError(
            f"Complaint status \"{old_status}\" is final and cannot be changed by field staff. "
            "Ask an administrator to reopen it."
        )

    permitted = ALLOWED_TRANSITIONS.get(old_status, [])
    if not is_reopen and new_status not in permitted:
        raise ValueError(
            f"Cannot change status from \"{old_status}\" to \"{new_status}\". "
            f"Allowed next statuses: {', '.join(permitted) if permitted else 'none (final)'}."
        )

    with db.transaction() as cur:
        resolved_clause = "CURRENT_TIMESTAMP" if is_closing else "NULL"
        cur.execute(
            f"""
            UPDATE dbo.Complaint
            SET status = ?, resolved_at = {resolved_clause}
            WHERE complaint_id = ?
            """,
            (new_status, complaint_id),
        )

        cur.execute(
            """
            INSERT INTO dbo.Complaint_History
              (complaint_id, staff_id, old_status, new_status, remarks, changed_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            """,
            (complaint_id, staff_id, old_status, new_status, trimmed_remarks),
        )

        # Adjust active_cases
        if is_closing and not was_closing:
            cur.execute(
                "UPDATE dbo.Staff SET active_cases = CASE WHEN active_cases > 0 THEN active_cases - 1 ELSE 0 END "
                "WHERE staff_id = ?",
                (staff_id,),
            )
        elif not is_closing and was_closing:
            cur.execute(
                "UPDATE dbo.Staff SET active_cases = CASE WHEN active_cases < 5 THEN active_cases + 1 ELSE 5 END "
                "WHERE staff_id = ?",
                (staff_id,),
            )
        elif new_status == "In Progress" and old_status == "Pending":
            cur.execute(
                "UPDATE dbo.Staff SET active_cases = CASE WHEN active_cases < 5 THEN active_cases + 1 ELSE 5 END "
                "WHERE staff_id = ?",
                (staff_id,),
            )

    _write_audit("UPDATE", "Complaint", complaint_id,
                 f"Status: {old_status} → {new_status} by staff #{staff_id}: {trimmed_remarks}")

    return {
        "complaint_id": complaint_id,
        "old_status": old_status,
        "new_status": new_status,
        "reopened": is_reopen,
    }


# ── Admin complaint queries ────────────────────────────────────────────────────

def get_all_complaints(
    search: str | None = None,
    department_id: int | None = None,
    status: str | None = None,
    priority: str | None = None,
    sort: str = "newest",
) -> list[dict]:
    direction = "ASC" if sort == "oldest" else "DESC"
    return db.fetchall(
        f"""
        SELECT
            c.complaint_id, c.title, c.description, c.category, c.priority,
            c.status, c.submitted_at, c.resolved_at,
            d.dept_id, d.dept_name AS department,
            s.staff_id, s.full_name AS assigned_staff,
            cit.citizen_id, cit.full_name AS citizen_name, cit.email AS citizen_email,
            l.area_name, l.city, l.district, l.pincode
        FROM dbo.Complaint AS c
        INNER JOIN dbo.Department AS d ON d.dept_id = c.dept_id
        INNER JOIN dbo.Citizen AS cit ON cit.citizen_id = c.citizen_id
        INNER JOIN dbo.Location AS l ON l.location_id = c.location_id
        LEFT JOIN dbo.Staff AS s ON s.staff_id = c.staff_id
        WHERE (? IS NULL OR c.title LIKE ? OR c.description LIKE ? OR cit.full_name LIKE ?)
          AND (? IS NULL OR d.dept_id = ?)
          AND (? IS NULL OR c.status = ?)
          AND (? IS NULL OR c.priority = ?)
        ORDER BY c.submitted_at {direction}
        """,
        (
            f"%{search}%" if search else None,
            f"%{search}%" if search else None,
            f"%{search}%" if search else None,
            f"%{search}%" if search else None,
            department_id, department_id,
            status if status and status != "All" else None,
            status if status and status != "All" else None,
            priority if priority and priority != "All" else None,
            priority if priority and priority != "All" else None,
        ),
    )


def assign_complaint(complaint_id: int, staff_id: int, admin_name: str) -> dict:
    """Assign a complaint to a staff member (admin action)."""
    staff = db.fetchone(
        "SELECT staff_id, full_name, active_cases FROM dbo.Staff WHERE staff_id = ?",
        (staff_id,),
    )
    if not staff:
        raise ValueError(f"Staff #{staff_id} does not exist.")

    with db.transaction() as cur:
        cur.execute(
            "UPDATE dbo.Complaint SET staff_id = ?, status = 'In Progress' WHERE complaint_id = ?",
            (staff_id, complaint_id),
        )
        cur.execute(
            """
            INSERT INTO dbo.Complaint_History
              (complaint_id, staff_id, old_status, new_status, remarks, changed_at)
            VALUES (?, ?, 'Pending', 'In Progress', ?, CURRENT_TIMESTAMP)
            """,
            (complaint_id, staff_id, f"Assigned to {staff['full_name']} by administrator {admin_name}."),
        )
        if staff["active_cases"] < 5:
            cur.execute(
                "UPDATE dbo.Staff SET active_cases = active_cases + 1 WHERE staff_id = ?",
                (staff_id,),
            )

    _write_audit("UPDATE", "Complaint", complaint_id,
                 f"Complaint assigned to staff #{staff_id} by {admin_name}")

    return {"staff_id": staff_id, "staff_name": staff["full_name"]}
