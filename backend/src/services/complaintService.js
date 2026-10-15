const path = require('path');
const fs = require('fs');
const { sql, getPool } = require('../config/db');
const { writeAuditLog } = require('./auditService');
const env = require('../config/env');

function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

/**
 * A complaint must carry a real place. Placeholder values such as
 * "General Area" / "City Center" / "00000" used to be written to the database
 * whenever the citizen did not move the map pin, which made the location data
 * meaningless. Missing or out-of-range input is now rejected.
 */
function validateLocation(location) {
  const loc = location || {};
  const areaName = String(loc.areaName || '').trim();
  const city = String(loc.city || '').trim();
  const district = String(loc.district || '').trim();
  const pincode = String(loc.pincode || '').trim();

  if (!areaName) throw validationError('Area / locality is required. Please pick the complaint location on the map.');
  if (!city) throw validationError('City is required.');
  if (!district) throw validationError('District is required.');
  if (!/^[A-Za-z0-9-]{3,10}$/.test(pincode)) {
    throw validationError('A valid postal code (3 to 10 characters) is required.');
  }

  const latitude = Number(loc.latitude);
  const longitude = Number(loc.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw validationError('A valid latitude between -90 and 90 is required. Drag the map pin or use "Use my location".');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw validationError('A valid longitude between -180 and 180 is required. Drag the map pin or use "Use my location".');
  }

  return {
    areaName: areaName.slice(0, 100),
    city: city.slice(0, 80),
    district: district.slice(0, 80),
    pincode: pincode.slice(0, 10),
    latitude: Math.round(latitude * 1000000) / 1000000,
    longitude: Math.round(longitude * 1000000) / 1000000
  };
}

async function createComplaint({ citizenId, deptId, title, description, category, priority, location, files = [] }) {
  if (!citizenId) throw validationError('Citizen ID is required.');
  if (!deptId) throw validationError('Department ID is required.');
  if (!title || !title.trim()) throw validationError('Complaint title is required.');
  if (!description || !description.trim()) throw validationError('Description is required.');
  if (!category || !category.trim()) throw validationError('Category is required.');
  if (title.trim().length > 200) throw validationError('Complaint title must be 200 characters or fewer.');

  if (!['Low', 'Medium', 'High', 'Critical'].includes(priority)) {
    throw validationError('Priority must be one of: Low, Medium, High, Critical.');
  }

  const loc = validateLocation(location);
  const pool = await getPool();

  // Referential integrity is checked here so the citizen gets a clear message
  // instead of a raw foreign-key error from the driver.
  const deptRes = await pool.request()
    .input('dept_id', sql.Int, Number(deptId))
    .query('SELECT dept_id, dept_name FROM dbo.Department WHERE dept_id = @dept_id');
  if (deptRes.recordset.length === 0) {
    throw validationError(`Department ${deptId} does not exist. Please choose a valid department.`);
  }

  const citRes = await pool.request()
    .input('citizen_id', sql.Int, citizenId)
    .query('SELECT citizen_id FROM dbo.Citizen WHERE citizen_id = @citizen_id');
  if (citRes.recordset.length === 0) {
    throw validationError('Your citizen record no longer exists. Please sign in again.');
  }

  // Accidental double-clicks on "Submit" would create a second identical case.
  // Only an identical title from the same citizen inside a short window is
  // treated as a duplicate; genuinely repeated complaints stay possible.
  const duplicateRes = await pool.request()
    .input('citizen_id', sql.Int, citizenId)
    .input('title', sql.VarChar(200), title.trim())
    .query(`
      SELECT TOP 1 complaint_id
      FROM dbo.Complaint
      WHERE citizen_id = @citizen_id
        AND title = @title
        AND submitted_at > DATEADD(SECOND, -30, CURRENT_TIMESTAMP)
    `);

  if (duplicateRes.recordset.length > 0) {
    const err = new Error(
      `An identical complaint was already submitted (${duplicateRes.recordset[0].complaint_id}). ` +
      'Please avoid submitting the same report twice.'
    );
    err.statusCode = 409;
    throw err;
  }

  // Location, complaint, attachments and the first history entry must all land
  // together; a partial write would leave an orphan location row.
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  let complaintId;
  try {
    // 1. Insert Location
    const locResult = await transaction.request()
      .input('area_name', sql.VarChar(100), loc.areaName)
      .input('city', sql.VarChar(80), loc.city)
      .input('district', sql.VarChar(80), loc.district)
      .input('pincode', sql.VarChar(10), loc.pincode)
      .input('latitude', sql.Decimal(9, 6), loc.latitude)
      .input('longitude', sql.Decimal(9, 6), loc.longitude)
      .query(`
        INSERT INTO dbo.Location (area_name, city, district, pincode, latitude, longitude)
        OUTPUT INSERTED.location_id
        VALUES (@area_name, @city, @district, @pincode, @latitude, @longitude)
      `);

    const locationId = locResult.recordset[0].location_id;

    // 2. Insert Complaint
    const compResult = await transaction.request()
      .input('citizen_id', sql.Int, citizenId)
      .input('dept_id', sql.Int, Number(deptId))
      .input('location_id', sql.Int, locationId)
      .input('title', sql.VarChar(200), title.trim())
      .input('description', sql.VarChar(sql.MAX), description.trim())
      .input('category', sql.VarChar(80), category.trim())
      .input('priority', sql.VarChar(10), priority)
      .query(`
        INSERT INTO dbo.Complaint
          (citizen_id, dept_id, location_id, title, description, category, priority, status, submitted_at)
        OUTPUT INSERTED.complaint_id
        VALUES
          (@citizen_id, @dept_id, @location_id, @title, @description, @category, @priority, 'Pending', CURRENT_TIMESTAMP)
      `);

    complaintId = compResult.recordset[0].complaint_id;

    // 3. Insert Attachments if uploaded
    for (const file of files) {
      await transaction.request()
        .input('complaint_id', sql.Int, complaintId)
        .input('file_name', sql.VarChar(255), file.originalname)
        .input('stored_name', sql.VarChar(255), file.filename)
        .input('file_path', sql.VarChar(500), path.relative(path.join(__dirname, '../../'), file.path))
        .input('file_size', sql.Int, file.size)
        .input('mime_type', sql.VarChar(100), file.mimetype)
        .query(`
          INSERT INTO dbo.Complaint_Attachment
            (complaint_id, file_name, stored_name, file_path, file_size, mime_type)
          VALUES (@complaint_id, @file_name, @stored_name, @file_path, @file_size, @mime_type)
        `);
    }

    // 4. Record initial Complaint_History
    await transaction.request()
      .input('complaint_id', sql.Int, complaintId)
      .input('old_status', sql.VarChar(50), 'None')
      .input('new_status', sql.VarChar(50), 'Pending')
      .input('remarks', sql.VarChar(sql.MAX), 'Complaint submitted by citizen with location and details.')
      .query(`
        INSERT INTO dbo.Complaint_History
          (complaint_id, staff_id, old_status, new_status, remarks, changed_at)
        VALUES (@complaint_id, NULL, @old_status, @new_status, @remarks, CURRENT_TIMESTAMP)
      `);

    await transaction.commit();
  } catch (txErr) {
    await transaction.rollback();
    // Uploaded files are outside the database transaction; remove them so a
    // rejected submission does not leave orphaned evidence on disk.
    for (const file of files) {
      try {
        fs.unlinkSync(file.path);
      } catch (unlinkError) {
        console.warn(`[Complaint] Could not remove orphan upload ${file.filename}`);
      }
    }

    // If the complaint row itself never got created, the location row is also
    // rolled back, so nothing partial is left behind.
    if (txErr.number === 547) {
      const err = new Error('One of the referenced records no longer exists. Please reload and try again.');
      err.statusCode = 400;
      throw err;
    }
    throw txErr;
  }

  await writeAuditLog('INSERT', 'Complaint', complaintId, `Complaint #${complaintId} created by citizen ${citizenId}`, 'Citizen');

  // Read the row back from the database so the citizen sees what was actually
  // stored (server-generated status, timestamps, assigned department name)
  // rather than an echo of the request body.
  const savedRes = await pool.request()
    .input('complaint_id', sql.Int, complaintId)
    .query(`
      SELECT
        c.complaint_id, c.title, c.category, c.priority, c.status,
        c.submitted_at, c.resolved_at,
        d.dept_id, d.dept_name AS department,
        l.area_name, l.city, l.district, l.pincode, l.latitude, l.longitude,
        (SELECT COUNT(*) FROM dbo.Complaint_Attachment WHERE complaint_id = c.complaint_id) AS attachment_count
      FROM dbo.Complaint AS c
      INNER JOIN dbo.Department AS d ON d.dept_id = c.dept_id
      INNER JOIN dbo.Location AS l ON l.location_id = c.location_id
      WHERE c.complaint_id = @complaint_id
    `);

  return {
    complaint_id: complaintId,
    complaint: savedRes.recordset[0] || null
  };
}

async function getComplaintsForCitizen(citizenId, { search, status, priority, sort }) {
  const pool = await getPool();
  const sortDirection = sort === 'oldest' ? 'ASC' : 'DESC';

  const req = pool.request()
    .input('citizen_id', sql.Int, citizenId)
    .input('search', sql.VarChar(200), search ? `%${search.trim()}%` : null)
    .input('status', sql.VarChar(20), status && status !== 'All' ? status.trim() : null)
    .input('priority', sql.VarChar(10), priority && priority !== 'All' ? priority.trim() : null);

  const result = await req.query(`
    SELECT
      c.complaint_id, c.title, c.description, c.category, c.priority,
      c.status, c.submitted_at, c.resolved_at,
      d.dept_id, d.dept_name AS department,
      s.full_name AS assigned_staff,
      l.area_name, l.city, l.district, l.pincode, l.latitude, l.longitude,
      (SELECT COUNT(*) FROM dbo.Complaint_Attachment WHERE complaint_id = c.complaint_id) AS attachment_count
    FROM dbo.Complaint AS c
    INNER JOIN dbo.Department AS d ON d.dept_id = c.dept_id
    INNER JOIN dbo.Location AS l ON l.location_id = c.location_id
    LEFT JOIN dbo.Staff AS s ON s.staff_id = c.staff_id
    WHERE c.citizen_id = @citizen_id
      AND (@search IS NULL OR c.title LIKE @search OR c.description LIKE @search OR c.category LIKE @search)
      AND (@status IS NULL OR c.status = @status)
      AND (@priority IS NULL OR c.priority = @priority)
    ORDER BY c.submitted_at ${sortDirection}
  `);

  return result.recordset;
}

async function getComplaintDetails(complaintId, user) {
  const pool = await getPool();

  const compResult = await pool.request()
    .input('complaint_id', sql.Int, complaintId)
    .query(`
      SELECT
        c.complaint_id, c.citizen_id, c.dept_id, c.title, c.description, c.category, c.priority,
        c.status, c.submitted_at, c.resolved_at,
        d.dept_name AS department, d.contact_email AS department_email, d.contact_phone AS department_phone,
        s.staff_id, s.full_name AS assigned_staff, s.email AS staff_email, s.phone AS staff_phone,
        cit.full_name AS citizen_name, cit.email AS citizen_email, cit.phone AS citizen_phone,
        l.area_name, l.city, l.district, l.pincode, l.latitude, l.longitude
      FROM dbo.Complaint AS c
      INNER JOIN dbo.Department AS d ON d.dept_id = c.dept_id
      INNER JOIN dbo.Location AS l ON l.location_id = c.location_id
      INNER JOIN dbo.Citizen AS cit ON cit.citizen_id = c.citizen_id
      LEFT JOIN dbo.Staff AS s ON s.staff_id = c.staff_id
      WHERE c.complaint_id = @complaint_id
    `);

  if (compResult.recordset.length === 0) {
    const err = new Error('Complaint not found.');
    err.statusCode = 404;
    throw err;
  }

  const complaint = compResult.recordset[0];

  // Authorization check: Citizen can only view their own complaints
  if (user.role_name === 'Citizen' && complaint.citizen_id !== user.citizen_id) {
    const forbidden = new Error('You are not authorized to view this complaint.');
    forbidden.statusCode = 403;
    throw forbidden;
  }

  // Fetch Attachments
  const attachResult = await pool.request()
    .input('complaint_id', sql.Int, complaintId)
    .query(`
      SELECT attachment_id, file_name, stored_name, file_size, mime_type, uploaded_at
      FROM dbo.Complaint_Attachment
      WHERE complaint_id = @complaint_id
      ORDER BY uploaded_at ASC
    `);

  // Fetch Timeline History
  const historyResult = await pool.request()
    .input('complaint_id', sql.Int, complaintId)
    .query(`
      SELECT
        h.history_id, h.old_status, h.new_status, h.remarks, h.changed_at,
        s.full_name AS staff_name, s.designation AS staff_designation
      FROM dbo.Complaint_History AS h
      LEFT JOIN dbo.Staff AS s ON s.staff_id = h.staff_id
      WHERE h.complaint_id = @complaint_id
      ORDER BY h.changed_at ASC
    `);

  // Fetch Feedback
  const feedbackResult = await pool.request()
    .input('complaint_id', sql.Int, complaintId)
    .query(`
      SELECT f.feedback_id, f.rating, f.comments, f.submitted_at, cit.full_name AS citizen_name
      FROM dbo.Feedback AS f
      INNER JOIN dbo.Citizen AS cit ON cit.citizen_id = f.citizen_id
      WHERE f.complaint_id = @complaint_id
      ORDER BY f.submitted_at DESC
    `);

  return {
    complaint,
    attachments: attachResult.recordset,
    history: historyResult.recordset,
    feedback: feedbackResult.recordset
  };
}

async function addFeedback(complaintId, citizenId, { rating, comments }) {
  const numericRating = Number(rating);
  if (!numericRating || numericRating < 1 || numericRating > 5) {
    const err = new Error('Rating must be an integer between 1 and 5.');
    err.statusCode = 400;
    throw err;
  }

  const pool = await getPool();

  // Validate ownership
  const comp = await pool.request()
    .input('complaint_id', sql.Int, complaintId)
    .input('citizen_id', sql.Int, citizenId)
    .query('SELECT complaint_id, status FROM dbo.Complaint WHERE complaint_id = @complaint_id AND citizen_id = @citizen_id');

  if (comp.recordset.length === 0) {
    const err = new Error('Complaint not found or you are not authorized to submit feedback.');
    err.statusCode = 404;
    throw err;
  }

  const result = await pool.request()
    .input('complaint_id', sql.Int, complaintId)
    .input('citizen_id', sql.Int, citizenId)
    .input('rating', sql.Int, numericRating)
    .input('comments', sql.VarChar(sql.MAX), comments ? comments.trim() : null)
    .query(`
      INSERT INTO dbo.Feedback (complaint_id, citizen_id, rating, comments)
      OUTPUT INSERTED.feedback_id, INSERTED.rating, INSERTED.comments, INSERTED.submitted_at
      VALUES (@complaint_id, @citizen_id, @rating, @comments)
    `);

  await writeAuditLog('INSERT', 'Feedback', complaintId, `Feedback submitted for complaint #${complaintId}: ${numericRating} stars`, 'Citizen');

  return result.recordset[0];
}

async function getAttachmentFile(complaintId, attachmentId, user) {
  const pool = await getPool();

  // Validate user access to the complaint
  await getComplaintDetails(complaintId, user);

  const fileResult = await pool.request()
    .input('attachment_id', sql.Int, attachmentId)
    .input('complaint_id', sql.Int, complaintId)
    .query(`
      SELECT attachment_id, file_name, stored_name, file_size, mime_type
      FROM dbo.Complaint_Attachment
      WHERE attachment_id = @attachment_id AND complaint_id = @complaint_id
    `);

  if (fileResult.recordset.length === 0) {
    const err = new Error('Attachment not found.');
    err.statusCode = 404;
    throw err;
  }

  const meta = fileResult.recordset[0];
  const diskPath = path.join(env.UPLOAD_DIR, meta.stored_name);

  if (!fs.existsSync(diskPath)) {
    const notFound = new Error('Attachment file is not present on the server.');
    notFound.statusCode = 404;
    throw notFound;
  }

  return {
    meta,
    filePath: diskPath
  };
}

module.exports = {
  createComplaint,
  getComplaintsForCitizen,
  getComplaintDetails,
  addFeedback,
  getAttachmentFile
};
