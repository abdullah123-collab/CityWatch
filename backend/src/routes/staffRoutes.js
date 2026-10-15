const express = require('express');
const router = express.Router();
const staffService = require('../services/staffService');
const { requireStaff } = require('../middleware/authMiddleware');

// GET /api/staff/dashboard
router.get('/dashboard', ...requireStaff, async (req, res, next) => {
  try {
    const data = await staffService.getStaffDashboard(req.user.staff_id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/staff/complaints
router.get('/complaints', ...requireStaff, async (req, res, next) => {
  try {
    const { search, status, priority } = req.query;
    const complaints = await staffService.getAssignedComplaints(req.user.staff_id, {
      search,
      status,
      priority
    });
    res.json(complaints);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/staff/complaints/:id/status
router.patch('/complaints/:id/status', ...requireStaff, async (req, res, next) => {
  try {
    const complaintId = Number(req.params.id);
    const { status, remarks } = req.body;
    const result = await staffService.updateComplaintStatus(
      req.user.staff_id,
      complaintId,
      { newStatus: status, remarks },
      { actorRole: req.user.role_name }
    );
    res.json({
      success: true,
      result,
      message: `Complaint #${complaintId} status updated to ${status}.`
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
