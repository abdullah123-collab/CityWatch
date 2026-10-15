const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../config/db');
const { writeAuditLog } = require('./auditService');

async function getAdminDashboard() {
  const pool = await getPool();

  // 1. Complaint overall counts
  const compStatsRes = await pool.request().query(`
    SELECT
      COUNT(*) AS total_complaints,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress,
      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
      SUM(CASE WHEN status = 'Rejected' THEN 1 ELSE 0 END) AS rejected
    FROM dbo.Complaint
  `);

  // 2. Total citizens & staff counts
  const citizenCountRes = await pool.request().query('SELECT COUNT(*) AS total_citizens FROM dbo.Citizen');
  const staffCountRes = await pool.request().query("SELECT COUNT(*) AS total_staff FROM dbo.Staff WHERE email <> 'admin@citywatch.gov'");

  // 3. Department distribution
  const deptStatsRes = await pool.request().query(`
    SELECT
      d.dept_id, d.dept_name, d.category,
      COUNT(c.complaint_id) AS complaint_count,
      SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_count
    FROM dbo.Department AS d
    LEFT JOIN dbo.Complaint AS c ON c.dept_id = d.dept_id
    GROUP BY d.dept_id, d.dept_name, d.category
    ORDER BY complaint_count DESC
  `);

  // 4. Staff workload summary
  const staffWorkloadRes = await pool.request().query(`
    SELECT
      s.staff_id, s.full_name, s.designation, s.active_cases,
      d.dept_name,
      a.is_active
    FROM dbo.Staff AS s
    INNER JOIN dbo.Department AS d ON d.dept_id = s.dept_id
    LEFT JOIN dbo.Auth_Account AS a ON a.staff_id = s.staff_id
    WHERE s.email <> 'admin@citywatch.gov'
    ORDER BY s.active_cases DESC
  `);

  // 5. Feedback average
  const feedbackRes = await pool.request().query(`
    SELECT
      COUNT(*) AS total_reviews,
      AVG(CAST(rating AS FLOAT)) AS average_rating
    FROM dbo.Feedback
  `);

  const comp = compStatsRes.recordset[0];
  const fb = feedbackRes.recordset[0];

  return {
    metrics: {
      totalComplaints: comp.total_complaints || 0,
      pendingComplaints: comp.pending || 0,
      inProgressComplaints: comp.in_progress || 0,
      resolvedComplaints: comp.resolved || 0,
      rejectedComplaints: comp.rejected || 0,
      totalCitizens: citizenCountRes.recordset[0].total_citizens || 0,
      totalStaff: staffCountRes.recordset[0].total_staff || 0,
      // No reviews yet must read as "no data", never as a perfect score.
      averageRating: fb.average_rating ? Number(Number(fb.average_rating).toFixed(2)) : null,
      totalReviews: fb.total_reviews || 0
    },
    departmentStats: deptStatsRes.recordset,
    staffWorkload: staffWorkloadRes.recordset
  };
}

async function getAllComplaints({ search, departmentId, status, priority, sort }) {
  const pool = await getPool();
  const sortDirection = sort === 'oldest' ? 'ASC' : 'DESC';

  const req = pool.request()
    .input('search', search ? `%${search.trim()}%` : null)
    .input('dept_id', departmentId ? Number(departmentId) : null)
    .input('status', status && status !== 'All' ? status.trim() : null)
    .input('priority', priority && priority !== 'All' ? priority.trim() : null);

  const result = await req.query(`
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
    WHERE (@search IS NULL OR c.title LIKE @search OR c.description LIKE @search OR cit.full_name LIKE @search)
      AND (@dept_id IS NULL OR c.dept_id = @dept_id)
      AND (@status IS NULL OR c.status = @status)
      AND (@priority IS NULL OR c.priority = @priority)
    ORDER BY c.submitted_at ${sortDirection}
  `);

  return result.recordset;
}

async function assignComplaint(complaintId, { staffId, adminName = 'Administrator' }) {
  const pool = await getPool();

  // Validate complaint exists
  const compRes = await pool.request()
    .input('complaint_id', sql.Int, complaintId)
    .query('SELECT complaint_id, dept_id, staff_id, status FROM dbo.Complaint WHERE complaint_id = @complaint_id');

  if (compRes.recordset.length === 0) {
    const err = new Error('Complaint not found.');
    err.statusCode = 404;
    throw err;
  }

  const complaint = compRes.recordset[0];

  // Validate staff exists and check active_cases
  const staffRes = await pool.request()
    .input('staff_id', sql.Int, staffId)
    .query(`
      SELECT s.staff_id, s.dept_id, s.full_name, s.active_cases,
             a.account_id, a.is_active
      FROM dbo.Staff AS s
      LEFT JOIN dbo.Auth_Account AS a ON a.staff_id = s.staff_id
      WHERE s.staff_id = @staff_id
    `);

  if (staffRes.recordset.length === 0) {
    const err = new Error('Staff member not found.');
    err.statusCode = 404;
    throw err;
  }

  const staff = staffRes.recordset[0];

  // A staff row without a provisioned Auth_Account cannot act on a case, so it
  // must not be assignable. SQL Server BIT arrives as a JS boolean here, so the
  // previous `is_active === false` test silently treated "no account" (NULL) as
  // active.
  if (!staff.account_id || !staff.is_active) {
    const err = new Error(
      `${staff.full_name} does not have an active login account and cannot be assigned cases. ` +
      'Provision or reactivate the account first.'
    );
    err.statusCode = 400;
    throw err;
  }

  // Department compatibility: a roads inspector must not receive a water case.
  if (staff.dept_id !== complaint.dept_id) {
    const err = new Error(
      `${staff.full_name} belongs to a different department and cannot be assigned this complaint.`
    );
    err.statusCode = 400;
    throw err;
  }

  // Workload constraint check (0 to 5)
  if (staff.active_cases >= 5) {
    const err = new Error(`${staff.full_name} has already reached the maximum capacity of 5 active cases.`);
    err.statusCode = 400;
    throw err;
  }

  const oldStaffId = complaint.staff_id;
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // If previously assigned to another staff member, decrement that staff member's active cases
    if (oldStaffId && oldStaffId !== staffId) {
      await transaction.request()
        .input('old_staff_id', sql.Int, oldStaffId)
        .query(`
          UPDATE dbo.Staff
          SET active_cases = CASE WHEN active_cases > 0 THEN active_cases - 1 ELSE 0 END
          WHERE staff_id = @old_staff_id
        `);
    }

    // Set complaint assigned staff and status to In Progress if currently Pending
    const nextStatus = complaint.status === 'Pending' ? 'In Progress' : complaint.status;

    await transaction.request()
      .input('complaint_id', sql.Int, complaintId)
      .input('staff_id', sql.Int, staffId)
      .input('status', sql.VarChar(20), nextStatus)
      .query(`
        UPDATE dbo.Complaint
        SET staff_id = @staff_id,
            status = @status
        WHERE complaint_id = @complaint_id
      `);

    // Increment new staff member active_cases
    await transaction.request()
      .input('staff_id', sql.Int, staffId)
      .query(`
        UPDATE dbo.Staff
        SET active_cases = CASE WHEN active_cases < 5 THEN active_cases + 1 ELSE 5 END
        WHERE staff_id = @staff_id
      `);

    // Record history
    await transaction.request()
      .input('complaint_id', sql.Int, complaintId)
      .input('staff_id', sql.Int, staffId)
      .input('old_status', sql.VarChar(50), complaint.status)
      .input('new_status', sql.VarChar(50), nextStatus)
      .input('remarks', sql.VarChar(sql.MAX), `Assigned to ${staff.full_name} by ${adminName}.`)
      .query(`
        INSERT INTO dbo.Complaint_History
          (complaint_id, staff_id, old_status, new_status, remarks, changed_at)
        VALUES (@complaint_id, @staff_id, @old_status, @new_status, @remarks, CURRENT_TIMESTAMP)
      `);

    await transaction.commit();
  } catch (txErr) {
    await transaction.rollback();
    throw txErr;
  }

  await writeAuditLog('UPDATE', 'Complaint', complaintId, `Complaint #${complaintId} assigned to staff #${staffId} (${staff.full_name})`, adminName);

  return { complaint_id: complaintId, staff_id: staffId, staff_name: staff.full_name };
}

async function getAllStaff() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      s.staff_id, s.dept_id, s.full_name, s.designation, s.email, s.phone, s.joined_at, s.active_cases,
      d.dept_name,
      a.account_id, a.role_name, a.is_active, a.created_at AS account_created_at
    FROM dbo.Staff AS s
    INNER JOIN dbo.Department AS d ON d.dept_id = s.dept_id
    LEFT JOIN dbo.Auth_Account AS a ON a.staff_id = s.staff_id
    ORDER BY s.staff_id ASC
  `);
  return result.recordset;
}

async function createStaffAccount({ fullName, email, phone, designation, deptId, roleName = 'Staff', password }) {
  const trimmedName = String(fullName || '').trim();
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const trimmedPhone = String(phone || '').trim();
  const trimmedDesignation = String(designation || '').trim();
  const departmentId = Number(deptId);

  if (!trimmedName) throw new Error('Full name is required.');
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) throw new Error('A valid email address is required.');
  if (!trimmedDesignation) throw new Error('Designation is required.');
  if (!departmentId) throw new Error('Department is required.');
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters long.');

  const pool = await getPool();

  // Check email conflict
  const existing = await pool.request()
    .input('email', sql.VarChar(100), trimmedEmail)
    .query('SELECT staff_id FROM dbo.Staff WHERE email = @email');

  if (existing.recordset.length > 0) {
    const err = new Error('A staff account with this email address already exists.');
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  let staffId;
  try {
    const staffRes = await transaction.request()
      .input('dept_id', sql.Int, departmentId)
      .input('full_name', sql.VarChar(100), trimmedName)
      .input('designation', sql.VarChar(80), trimmedDesignation)
      .input('email', sql.VarChar(100), trimmedEmail)
      .input('phone', sql.VarChar(20), trimmedPhone || null)
      .input('joined_at', sql.Date, new Date())
      .input('active_cases', sql.Int, 0)
      .query(`
        INSERT INTO dbo.Staff
          (dept_id, full_name, designation, email, phone, joined_at, active_cases)
        OUTPUT INSERTED.staff_id
        VALUES (@dept_id, @full_name, @designation, @email, @phone, @joined_at, @active_cases)
      `);

    staffId = staffRes.recordset[0].staff_id;

    await transaction.request()
      .input('account_type', sql.VarChar(20), 'Staff')
      .input('staff_id', sql.Int, staffId)
      .input('password_hash', sql.VarChar(255), passwordHash)
      .input('role_name', sql.VarChar(20), roleName === 'Admin' ? 'Admin' : 'Staff')
      .query(`
        INSERT INTO dbo.Auth_Account
          (account_type, staff_id, password_hash, role_name, is_active)
        VALUES (@account_type, @staff_id, @password_hash, @role_name, 1)
      `);

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  await writeAuditLog('INSERT', 'Staff', staffId, `Staff account created: ${trimmedEmail} (${trimmedDesignation})`, 'Admin');

  return { staff_id: staffId, full_name: trimmedName, email: trimmedEmail };
}

async function setStaffActiveStatus(staffId, isActive) {
  const pool = await getPool();

  // An UPDATE that matches no rows used to be reported as success, so toggling
  // a staff member without a provisioned login appeared to work.
  const existing = await pool.request()
    .input('staff_id', sql.Int, staffId)
    .query('SELECT account_id FROM dbo.Auth_Account WHERE staff_id = @staff_id');

  if (existing.recordset.length === 0) {
    const err = new Error(
      'This staff member has no login account yet, so there is nothing to activate. ' +
      'Use "Add New Staff Member" to create the account with a password.'
    );
    err.statusCode = 404;
    throw err;
  }

  const result = await pool.request()
    .input('staff_id', sql.Int, staffId)
    .input('is_active', sql.Bit, isActive ? 1 : 0)
    .query(`
      UPDATE dbo.Auth_Account
      SET is_active = @is_active, updated_at = CURRENT_TIMESTAMP
      WHERE staff_id = @staff_id
    `);

  if (result.rowsAffected[0] !== 1) {
    throw new Error('The staff login account could not be updated.');
  }

  await writeAuditLog('UPDATE', 'Auth_Account', staffId, `Staff #${staffId} active status set to ${isActive}`, 'Admin');
  return { staff_id: staffId, account_id: existing.recordset[0].account_id, is_active: Boolean(isActive) };
}

async function getAllCitizens() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      c.citizen_id, c.full_name, c.email, c.phone, c.address, c.registered_at,
      a.is_active,
      (SELECT COUNT(*) FROM dbo.Complaint WHERE citizen_id = c.citizen_id) AS complaint_count
    FROM dbo.Citizen AS c
    LEFT JOIN dbo.Auth_Account AS a ON a.citizen_id = c.citizen_id
    ORDER BY c.registered_at DESC
  `);
  return result.recordset;
}

async function getAllDepartments() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      d.dept_id, d.dept_name, d.category, d.contact_email, d.contact_phone, d.head_officer,
      (SELECT COUNT(*) FROM dbo.Staff WHERE dept_id = d.dept_id AND email <> 'admin@citywatch.gov') AS staff_count,
      (SELECT COUNT(*) FROM dbo.Complaint WHERE dept_id = d.dept_id) AS total_complaints
    FROM dbo.Department AS d
    ORDER BY d.dept_name ASC
  `);
  return result.recordset;
}

async function createDepartment({ deptName, category, contactEmail, contactPhone, headOfficer }) {
  if (!deptName || !deptName.trim()) throw new Error('Department name is required.');
  if (!category || !category.trim()) throw new Error('Category is required.');

  const pool = await getPool();
  const result = await pool.request()
    .input('dept_name', sql.VarChar(100), deptName.trim())
    .input('category', sql.VarChar(80), category.trim())
    .input('contact_email', sql.VarChar(100), contactEmail ? contactEmail.trim() : null)
    .input('contact_phone', sql.VarChar(20), contactPhone ? contactPhone.trim() : null)
    .input('head_officer', sql.VarChar(100), headOfficer ? headOfficer.trim() : null)
    .query(`
      INSERT INTO dbo.Department (dept_name, category, contact_email, contact_phone, head_officer)
      OUTPUT INSERTED.dept_id, INSERTED.dept_name
      VALUES (@dept_name, @category, @contact_email, @contact_phone, @head_officer)
    `);

  return result.recordset[0];
}

async function getAllFeedback() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT
      f.feedback_id, f.rating, f.comments, f.submitted_at,
      c.complaint_id, c.title AS complaint_title,
      d.dept_name,
      cit.full_name AS citizen_name, cit.email AS citizen_email
    FROM dbo.Feedback AS f
    INNER JOIN dbo.Complaint AS c ON c.complaint_id = f.complaint_id
    INNER JOIN dbo.Department AS d ON d.dept_id = c.dept_id
    INNER JOIN dbo.Citizen AS cit ON cit.citizen_id = f.citizen_id
    ORDER BY f.submitted_at DESC
  `);
  return result.recordset;
}

async function getAuditLogs() {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT TOP 100
      audit_id, action_type, table_name, record_id, action_details, action_by, action_at
    FROM dbo.Audit_Log
    ORDER BY action_at DESC
  `);
  return result.recordset;
}

module.exports = {
  getAdminDashboard,
  getAllComplaints,
  assignComplaint,
  getAllStaff,
  createStaffAccount,
  setStaffActiveStatus,
  getAllCitizens,
  getAllDepartments,
  createDepartment,
  getAllFeedback,
  getAuditLogs
};
