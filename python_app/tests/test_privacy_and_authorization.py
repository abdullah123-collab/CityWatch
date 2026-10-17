"""
Tests for privacy rules, ownership checks, and complaint lifecycle policies.
"""
import pytest
from unittest.mock import patch, Mock

from app.core.config import settings
from app.core.security import create_session_cookie
from app.repositories import complaint_repository as cr


def test_complaint_status_transition_rules():
    assert "In Progress" in cr.ALLOWED_TRANSITIONS["Pending"]
    assert "Rejected" in cr.ALLOWED_TRANSITIONS["Pending"]
    assert "Resolved" in cr.ALLOWED_TRANSITIONS["In Progress"]
    assert "Rejected" in cr.ALLOWED_TRANSITIONS["In Progress"]
    # Final terminal statuses
    assert cr.ALLOWED_TRANSITIONS["Resolved"] == []
    assert cr.ALLOWED_TRANSITIONS["Rejected"] == []


def test_citizen_phone_privacy_isolation():
    """
    Authorized staff contact test:
    - Citizen phone number is revealed ONLY to the staff member assigned to that complaint (or Admin).
    - Unassigned staff member cannot view details or receive phone number.
    - Other citizens cannot view other citizens' complaints.
    """
    mock_complaint_row = {
        "complaint_id": 55,
        "title": "Water leak",
        "description": "Pipe leaking",
        "category": "Water",
        "priority": "High",
        "status": "In Progress",
        "submitted_at": "2026-10-16T10:00:00",
        "resolved_at": None,
        "citizen_id": 101,
        "citizen_name": "Citizen Jane",
        "citizen_email": "jane@example.com",
        "citizen_phone": "+1-555-0199",
        "dept_id": 3,
        "department": "Water Supply",
        "staff_id": 7,
        "assigned_staff": "Officer Bob",
        "area_name": "Ward 4",
        "city": "Metropolis",
        "district": "Central",
        "pincode": "44000",
        "latitude": None,
        "longitude": None,
        "location_id": 12,
    }

    with patch("app.core.database.fetchone", return_value=mock_complaint_row), \
         patch("app.core.database.fetchall", return_value=[]):

        # 1. Assigned staff member (staff_id = 7)
        assigned_officer = {"role_name": "Staff", "staff_id": 7, "full_name": "Officer Bob"}
        details = cr.get_complaint_details(55, assigned_officer)
        assert details["complaint"]["citizen_phone"] == "+1-555-0199"

        # 2. Administrator sees details and phone
        admin_user = {"role_name": "Admin", "full_name": "Admin User"}
        admin_details = cr.get_complaint_details(55, admin_user)
        assert admin_details["complaint"]["citizen_phone"] == "+1-555-0199"

        # 3. Owning citizen (citizen_id = 101) sees details
        owner_citizen = {"role_name": "Citizen", "citizen_id": 101}
        citizen_details = cr.get_complaint_details(55, owner_citizen)
        assert citizen_details["complaint"]["complaint_id"] == 55

        # 4. Other citizen (citizen_id = 999) is BLOCKED
        intruder_citizen = {"role_name": "Citizen", "citizen_id": 999}
        with pytest.raises(PermissionError, match="permission"):
            cr.get_complaint_details(55, intruder_citizen)

        # 5. Unassigned staff member (staff_id = 99) is BLOCKED
        unrelated_staff = {"role_name": "Staff", "staff_id": 99, "full_name": "Officer Carol"}
        with pytest.raises(PermissionError, match="not assigned to you"):
            cr.get_complaint_details(55, unrelated_staff)
