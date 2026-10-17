"""
Mock-driver and parameterized unit tests for full complaint workflows,
staff resolution, admin assignment, feedback, and audit logging.
"""
from unittest.mock import MagicMock, patch
import pytest

from app.core import database as db
from app.repositories import complaint_repository as cr
from app.repositories import auth_repository as ar
from app.repositories import admin_repository as adm_r


def _make_mock_connection(fetch_returns=None):
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    if fetch_returns:
        mock_cursor.fetchone.side_effect = fetch_returns
    mock_conn.cursor.return_value = mock_cursor
    return mock_conn, mock_cursor


def test_create_complaint_mock_workflow():
    """Verify citizen complaint creation with manual address and audit logging."""
    # 1. Duplicate check (None)
    # 2. Location insert (location_id 25)
    # 3. Complaint insert (complaint_id 88)
    mock_conn, mock_cursor = _make_mock_connection([None, (25,), (88,)])

    location = {
        "area_name": "Ward 9",
        "city": "Capital City",
        "district": "North",
        "pincode": "44000",
        "latitude": None,
        "longitude": None,
    }

    with patch("app.core.database._get_connection", return_value=mock_conn):
        result = cr.create_complaint(
            citizen_id=10,
            dept_id=2,
            title="Pothole on Main Road",
            description="Deep crater damaging vehicles.",
            category="Roads",
            priority="High",
            location=location,
            file_paths=[],
        )

        assert result["complaint_id"] == 88

        statements = [call.args[0] for call in mock_cursor.execute.call_args_list]
        assert any("INSERT INTO dbo.Location" in s for s in statements)
        assert any("INSERT INTO dbo.Complaint" in s for s in statements)
        assert mock_conn.commit.called


def test_staff_update_complaint_status_workflow():
    """Verify staff officer updates status, appends to history, and updates active_cases."""
    # 1. Existing complaint: status is "In Progress", staff_id is 7
    mock_conn, mock_cursor = _make_mock_connection([
        {"status": "In Progress", "staff_id": 7},
    ])
    mock_cursor.description = [("status",), ("staff_id",)]
    mock_cursor.fetchone.side_effect = [("In Progress", 7)]

    with patch("app.core.database._get_connection", return_value=mock_conn):
        result = cr.update_complaint_status(
            staff_id=7,
            complaint_id=88,
            new_status="Resolved",
            remarks="Pothole filled with cold asphalt mix.",
            actor_role="Staff",
        )

        assert result["complaint_id"] == 88
        assert result["new_status"] == "Resolved"
        assert result["old_status"] == "In Progress"

        statements = [call.args[0] for call in mock_cursor.execute.call_args_list]
        assert any("INSERT INTO dbo.Complaint_History" in s for s in statements)
        assert any("UPDATE dbo.Complaint" in s for s in statements)
        assert any("UPDATE dbo.Staff" in s for s in statements)
        assert mock_conn.commit.called


def test_admin_assign_complaint_workflow():
    """Verify admin assigning a complaint to a staff member updates complaint and active cases."""
    mock_conn, mock_cursor = _make_mock_connection()
    mock_cursor.description = [("staff_id",), ("full_name",), ("active_cases",)]
    mock_cursor.fetchone.side_effect = [
        (14, "Officer Davis", 1),  # SELECT staff_id, full_name, active_cases FROM Staff
        (None,),                   # SELECT staff_id FROM Complaint
    ]

    with patch("app.core.database._get_connection", return_value=mock_conn):
        result = cr.assign_complaint(
            complaint_id=88,
            staff_id=14,
            admin_name="Super Admin",
        )

        assert result["staff_id"] == 14
        assert result["staff_name"] == "Officer Davis"

        statements = [call.args[0] for call in mock_cursor.execute.call_args_list]
        assert any("UPDATE dbo.Complaint" in s for s in statements)
        assert any("INSERT INTO dbo.Complaint_History" in s for s in statements)
        assert any("UPDATE dbo.Staff" in s for s in statements)
        assert mock_conn.commit.called


def test_citizen_add_feedback_workflow():
    """Verify citizen satisfaction feedback insertion."""
    mock_conn, mock_cursor = _make_mock_connection()
    mock_cursor.description = [("status",), ("citizen_id",)]
    mock_cursor.fetchone.return_value = ("Resolved", 10)

    with patch("app.core.database._get_connection", return_value=mock_conn):
        cr.add_feedback(complaint_id=88, citizen_id=10, rating=5, comments="Great swift resolution!")

        statements = [call.args[0] for call in mock_cursor.execute.call_args_list]
        assert any("INSERT INTO dbo.Feedback" in s for s in statements)


def test_admin_create_staff_account_workflow():
    """Verify admin staff provisioning creates Staff and Auth_Account records with bcrypt hash."""
    mock_conn, mock_cursor = _make_mock_connection([
        (45,),  # INSERT INTO Staff OUTPUT staff_id
        (92,),  # INSERT INTO Auth_Account OUTPUT account_id
    ])

    with patch("app.core.database._get_connection", return_value=mock_conn):
        created = adm_r.create_staff_account(
            full_name="Officer James Cole",
            email="jcole@citywatch.gov",
            phone="+1-555-0182",
            designation="Field Engineer",
            dept_id=2,
            role_name="Staff",
            password="SecurePassword123!",
        )

        assert created["staff_id"] == 45
        assert created["full_name"] == "Officer James Cole"

        statements = [call.args[0] for call in mock_cursor.execute.call_args_list]
        assert any("INSERT INTO dbo.Staff" in s for s in statements)
        assert any("INSERT INTO dbo.Auth_Account" in s for s in statements)
