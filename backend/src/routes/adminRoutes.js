const express = require('express');
const router = express.Router();
const adminService = require('../services/adminService');
const complaintService = require('../services/complaintService');
const { requireAdmin } = require('../middleware/authMiddleware');

// All admin routes require Admin role
router.use(...requireAdmin);

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const data = await adminService.getAdminDashboard();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/complaints
router.get('/complaints', async (req, res, next) => {
  try {
    const { search, departmentId, status, priority, sort } = req.query;
    const complaints = await adminService.getAllComplaints({
      search,
      departmentId,
      status,
      priority,
      sort
    });
    res.json(complaints);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/complaints/:id - Full case file for one complaint
// Reuses the citizen/staff detail reader, which already assembles complaint,
// attachments, timeline and feedback; an Admin passes its authorization check.
router.get('/complaints/:id', async (req, res, next) => {
  try {
    const complaintId = Number(req.params.id);
    if (!complaintId) {
      const err = new Error('Invalid complaint ID.');
      err.statusCode = 400;
      throw err;
    }
    const data = await complaintService.getComplaintDetails(complaintId, req.user);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/complaints/:id/assign
router.post('/complaints/:id/assign', async (req, res, next) => {
  try {
    const complaintId = Number(req.params.id);
    const { staffId } = req.body;
    if (!staffId) {
      const err = new Error('Staff ID is required for assignment.');
      err.statusCode = 400;
      throw err;
    }
    const result = await adminService.assignComplaint(complaintId, {
      staffId: Number(staffId),
      adminName: req.user.full_name || 'Administrator'
    });
    res.json({
      success: true,
      result,
      message: `Complaint #${complaintId} assigned to ${result.staff_name}.`
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/staff
router.get('/staff', async (req, res, next) => {
  try {
    const staff = await adminService.getAllStaff();
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/staff
router.post('/staff', async (req, res, next) => {
  try {
    const { fullName, email, phone, designation, deptId, roleName, password } = req.body;
    const created = await adminService.createStaffAccount({
      fullName,
      email,
      phone,
      designation,
      deptId,
      roleName,
      password
    });
    res.status(201).json({
      success: true,
      staff: created,
      message: `Staff account created for ${created.full_name}.`
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/staff/:id/status
router.patch('/staff/:id/status', async (req, res, next) => {
  try {
    const staffId = Number(req.params.id);
    const { isActive } = req.body;
    const result = await adminService.setStaffActiveStatus(staffId, isActive);
    res.json({
      success: true,
      result,
      message: `Staff #${staffId} is now ${isActive ? 'Active' : 'Deactivated'}.`
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/citizens
router.get('/citizens', async (req, res, next) => {
  try {
    const citizens = await adminService.getAllCitizens();
    res.json(citizens);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/departments
router.get('/departments', async (req, res, next) => {
  try {
    const depts = await adminService.getAllDepartments();
    res.json(depts);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/departments
router.post('/departments', async (req, res, next) => {
  try {
    const { deptName, category, contactEmail, contactPhone, headOfficer } = req.body;
    const dept = await adminService.createDepartment({
      deptName,
      category,
      contactEmail,
      contactPhone,
      headOfficer
    });
    res.status(201).json({ success: true, department: dept });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/feedback
router.get('/feedback', async (req, res, next) => {
  try {
    const feedback = await adminService.getAllFeedback();
    res.json(feedback);
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/audit-logs
router.get('/audit-logs', async (req, res, next) => {
  try {
    const logs = await adminService.getAuditLogs();
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
