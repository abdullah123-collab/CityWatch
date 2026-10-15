const express = require('express');
const router = express.Router();
const path = require('path');
const complaintService = require('../services/complaintService');
const { requireAuth, requireCitizen } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// POST /api/complaints - Submit complaint with optional file attachments
router.post('/', ...requireCitizen, upload.array('attachments', 5), async (req, res, next) => {
  try {
    const { departmentId, title, description, category, priority } = req.body;

    let locationData = {};
    if (typeof req.body.location === 'string') {
      // A malformed location payload used to be swallowed and turned into an
      // empty object, which produced a confusing "area is required" error.
      try {
        locationData = JSON.parse(req.body.location);
      } catch (parseError) {
        const err = new Error('The location field is not valid JSON and could not be read.');
        err.statusCode = 400;
        throw err;
      }
    } else if (req.body.location) {
      locationData = req.body.location;
    } else {
      locationData = {
        areaName: req.body.areaName,
        city: req.body.city,
        district: req.body.district,
        pincode: req.body.pincode,
        latitude: req.body.latitude,
        longitude: req.body.longitude
      };
    }

    const created = await complaintService.createComplaint({
      citizenId: req.user.citizen_id,
      deptId: Number(departmentId),
      title,
      description,
      category,
      priority,
      location: locationData,
      files: req.files || []
    });

    res.status(201).json({
      success: true,
      complaintId: created.complaint_id,
      complaint: created.complaint,
      message: 'Complaint registered successfully and assigned to department queue.'
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints - List complaints for citizen
router.get('/', ...requireCitizen, async (req, res, next) => {
  try {
    const { search, status, priority, sort } = req.query;
    const complaints = await complaintService.getComplaintsForCitizen(req.user.citizen_id, {
      search,
      status,
      priority,
      sort
    });
    res.json(complaints);
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/:id - View complaint details
router.get('/:id', requireAuth, async (req, res, next) => {
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

// POST /api/complaints/:id/feedback - Submit citizen rating
router.post('/:id/feedback', ...requireCitizen, async (req, res, next) => {
  try {
    const complaintId = Number(req.params.id);
    const { rating, comments } = req.body;
    const feedback = await complaintService.addFeedback(complaintId, req.user.citizen_id, {
      rating,
      comments
    });
    res.status(201).json({ success: true, feedback });
  } catch (err) {
    next(err);
  }
});

// GET /api/complaints/:id/attachments/:attachmentId - Secure attachment serving
router.get('/:id/attachments/:attachmentId', requireAuth, async (req, res, next) => {
  try {
    const complaintId = Number(req.params.id);
    const attachmentId = Number(req.params.attachmentId);
    const { meta, filePath } = await complaintService.getAttachmentFile(complaintId, attachmentId, req.user);

    res.setHeader('Content-Type', meta.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(meta.file_name)}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
