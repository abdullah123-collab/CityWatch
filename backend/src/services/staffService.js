const { sql, getPool } = require('../config/db');
const { writeAuditLog } = require('./auditService');

const VALID_STATUSES = ['Pending', 'In Progress', 'Resolved', 'Rejected'];

// Closed cases are not silently reopened by a field officer; that would make
// the reported resolution counts meaningless.
const ALLOWED_TRANSITIONS = {
  Pending: ['In Progress', 'Rejected'],
  'In Progress': ['Resolved', 'Rejected'],
  Resolved: [],
  Rejected: []
};

function normalizeStatus(value) {
  if (typeof value !== 'string') return null;
  const match = VALID_STATUSES.find(status => status.toLowerCase() === value.trim().toLowerCase());
  return match || null;
}

async function getStaffDashboard(staffId) {
  const pool = await getPool();

  const staffRes = await pool.request()
    .input('staff_id', sql.Int, staffId)
    .query(`
      SELECT s.staff_id, s.full_name, s.designation, s.email, s.active_cases, d.dept_name
      FROM dbo.Staff AS s
      INNER JOIN dbo.Department AS d ON d.dept_id = s.dept_id
      WHERE s.staff_id = @staff_id
    `);

  if (staffRes.recordset.length === 0) {
    const err = new Error('Staff member not found.');
    err.statusCode = 404;
    throw err;
  }

  const staff = staffRes.recordset[0];

  const countsRes = await pool.request()
    .input('staff_id', sql.Int, staffId)
    .query(`
      SELECT
        COUNT(*) AS total_assigned,
        SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_count,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_count,
        SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected_count
      FROM dbo.Complaint
      WHERE staff_id = @staff_id
    `);

  const counts = countsRes.recordset[0];

  return {
    staff,
    workload: {
      activeCases: staff.active_cases,
      maxCapacity: 5,
      utilizationPercentage: Math.round((staff.active_cases / 5) * 100)
    },
    counts: {
      total: counts.total_assigned || 0,
      pending: counts.pending_count || 0,
      inProgress: counts.in_progress_count || 0,
      resolved: counts.resolved_count || 0,
      rejected: counts.rejected_count || 0
    }
  };
}

async function getAssignedComplaints(staffId, { search, status, priority }) {
  const pool = await getPool();

  const req = pool.request()
    .input('staff_id', sql.Int, staffId)
    .input('search', search ? `%${search.trim()}%` : null)
    .input('status', status && status !== 'All' ? status.trim() : null)
    .input('priority', priority && priority !== 'All' ? priority.trim() : null);

  const result = await req.query(`
    SELECT
      c.complaint_id, c.title, c.description, c.category, c.priority,
      c.status, c.submitted_at, c.resolved_at,
      d.dept_name AS department,
      cit.full_name AS citizen_name, cit.email AS citizen_email, cit.phone AS citizen_phone,
      l.area_name, l.city, l.district, l.pincode, l.latitude, l.longitude,
      (SELECT COUNT(*) FROM dbo.Complaint_Attachment WHERE complaint_id = c.complaint_id) AS attachment_count
    FROM dbo.Complaint AS c
    INNER JOIN dbo.Department AS d ON d.dept_id = c.dept_id
    INNER JOIN dbo.Citizen AS cit ON cit.citizen_id = c.citizen_id
    INNER JOIN dbo.Location AS l ON l.location_id = c.location_id
    WHERE c.staff_id = @staff_id
      AND (@search IS NULL OR c.title LIKE @search OR c.description LIKE @search OR cit.full_name LIKE @search)
      AND (@status IS NULL OR c.status = @status)
      AND (@priority IS NULL OR c.priority = @priority)
    ORDER BY c.submitted_at DESC
  `);

  return result.recordset;
}

async function updateComplaintStatus(staffId, complaintId, { newStatus, remarks }, { actorRole = 'Staff' } = {}) {
  const targetStatus = normalizeStatus(newStatus);
  if (!targetStatus) {
    const err = new Error(`Invalid status '${newStatus}'. Allowed statuses are: ${VALID_STATUSES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // Inspectors must record why the case moved; blank remarks made the history
  // table useless for audit.
  const trimmedRemarks = String(remarks || '').trim();
  if (!trimmedRemarks) {
    const err = new Error('Remarks are required when updating a complaint status.');
    err.statusCode = 400;
    throw err;
  }
  if (trimmedRemarks.length > 2000) {
    const err = new Error('Remarks must be 2000 characters or fewer.');
    err.statusCode = 400;
    throw err;
  }

  const pool = await getPool();

  // Check assignment
  const checkComp = await pool.request()
    .input('complaint_id', sql.Int, complaintId)
    .input('staff_id', sql.Int, staffId)
    .query('SELECT complaint_id, status FROM dbo.Complaint WHERE complaint_id = @complaint_id AND staff_id = @staff_id');

  if (checkComp.recordset.length === 0) {
    const err = new Error('Complaint is not assigned to this staff member or does not exist.');
    err.statusCode = 403;
    throw err;
  }

  const oldStatus = checkComp.recordset[0].status;

  if (oldStatus === targetStatus) {
    const err = new Error(`Complaint is already "${oldStatus}". Choose a different status.`);
    err.statusCode = 400;
    throw err;
  }

  const isClosing = ['Resolved', 'Rejected'].includes(targetStatus);
  const wasClosing = ['Resolved', 'Rejected'].includes(oldStatus);
  // Reopening a closed case returns it to the officer queue; only an
  // administrator may do that, otherwise the resolution counts stop being
  // trustworthy.
  const isReopen = wasClosing && !isClosing;

  const permitted = ALLOWED_TRANSITIONS[oldStatus] || [];
  if (isReopen && actorRole !== 'Admin') {
    const err = new Error(
      `Complaint status "${oldStatus}" is final and cannot be changed by field staff. ` +
      'Ask an administrator to reopen it.'
    );
    err.statusCode = 409;
    throw err;
  }

  if (!isReopen && !permitted.includes(targetStatus)) {
    const err = new Error(
      permitted.length === 0
        ? `Complaint status "${oldStatus}" is final and cannot be changed by field staff. Ask an administrator to reopen it.`
        : `Cannot change status from "${oldStatus}" to "${targetStatus}". Allowed next statuses: ${permitted.join(', ')}.`
    );
    err.statusCode = 409;
    throw err;
  }

  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await transaction.request()
      .input('complaint_id', sql.Int, complaintId)
      .input('new_status', sql.VarChar(20), targetStatus)
      .query(`
        UPDATE dbo.Complaint
        SET status = @new_status,
            resolved_at = ${isClosing ? 'CURRENT_TIMESTAMP' : 'NULL'}
        WHERE complaint_id = @complaint_id
      `);

    await transaction.request()
      .input('complaint_id', sql.Int, complaintId)
      .input('staff_id', sql.Int, staffId)
      .input('old_status', sql.VarChar(50), oldStatus)
      .input('new_status', sql.VarChar(50), targetStatus)
      .input('remarks', sql.VarChar(sql.MAX), trimmedRemarks)
      .query(`
        INSERT INTO dbo.Complaint_History
          (complaint_id, staff_id, old_status, new_status, remarks, changed_at)
        VALUES (@complaint_id, @staff_id, @old_status, @new_status, @remarks, CURRENT_TIMESTAMP)
      `);

    // Adjust active_cases:
    // If opening/in-progress and wasn't previously open: active_cases + 1
    // If closing and wasn't previously closed: active_cases - 1
    if (isClosing && !wasClosing) {
      await transaction.request()
        .input('staff_id', sql.Int, staffId)
        .query(`
          UPDATE dbo.Staff
          SET active_cases = CASE WHEN active_cases > 0 THEN active_cases - 1 ELSE 0 END
          WHERE staff_id = @staff_id
        `);
    } else if (!isClosing && wasClosing) {
      // Reopened by an administrator: give the case back to the officer,
      // respecting the same 0-5 workload constraint the schema enforces.
      await transaction.request()
        .input('staff_id', sql.Int, staffId)
        .query(`
          UPDATE dbo.Staff
          SET active_cases = CASE WHEN active_cases < 5 THEN active_cases + 1 ELSE 5 END
          WHERE staff_id = @staff_id
        `);
    } else if (targetStatus === 'In Progress' && oldStatus === 'Pending') {
      await transaction.request()
        .input('staff_id', sql.Int, staffId)
        .query(`
          UPDATE dbo.Staff
          SET active_cases = CASE WHEN active_cases < 5 THEN active_cases + 1 ELSE 5 END
          WHERE staff_id = @staff_id
        `);
    }

    await transaction.commit();
  } catch (txErr) {
    await transaction.rollback();
    throw txErr;
  }

  await writeAuditLog(
    'UPDATE',
    'Complaint',
    complaintId,
    `Complaint #${complaintId} status changed from ${oldStatus} to ${targetStatus}${isReopen ? ' (reopened)' : ''}: ${trimmedRemarks}`,
    `Staff #${staffId}`
  );

  return {
    complaint_id: complaintId,
    old_status: oldStatus,
    new_status: targetStatus,
    reopened: isReopen
  };
}

module.exports = {
  getStaffDashboard,
  getAssignedComplaints,
  updateComplaintStatus
};
