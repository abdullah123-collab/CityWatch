const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sql, getPool } = require('../config/db');
const env = require('../config/env');
const { writeAuditLog } = require('./auditService');

/**
 * Validation failures must reach the client as 400s with an actionable message,
 * not as opaque 500s.
 */
function validationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest();
}

function setSessionCookie(response, token) {
  const isProd = env.NODE_ENV === 'production';
  const cookieOptions = [
    `${env.SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${Math.floor(env.SESSION_MAX_AGE_MS / 1000)}`
  ];
  if (isProd) cookieOptions.push('Secure');
  response.setHeader('Set-Cookie', cookieOptions.join('; '));
}

function clearSessionCookie(response) {
  response.setHeader('Set-Cookie', `${env.SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

async function createSession(accountId, response) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenBinary = hashToken(token);
  const pool = await getPool();

  await pool.request()
    .input('account_id', sql.Int, accountId)
    .input('token_hash', sql.VarBinary(64), tokenBinary)
    .query(`
      INSERT INTO dbo.Auth_Session (account_id, token_hash, expires_at)
      VALUES (@account_id, @token_hash, DATEADD(MILLISECOND, ${env.SESSION_MAX_AGE_MS}, CURRENT_TIMESTAMP))
    `);

  setSessionCookie(response, token);
  return token;
}

async function getUserFromToken(token) {
  if (!token) return null;
  const tokenBinary = hashToken(token);
  const pool = await getPool();

  const result = await pool.request()
    .input('token_hash', sql.VarBinary(64), tokenBinary)
    .query(`
      SELECT TOP 1
        a.account_id, a.account_type, a.role_name, a.is_active,
        c.citizen_id, c.full_name AS citizen_name, c.email AS citizen_email, c.phone AS citizen_phone, c.address AS citizen_address,
        st.staff_id, st.full_name AS staff_name, st.email AS staff_email, st.designation, st.active_cases,
        d.dept_id, d.dept_name
      FROM dbo.Auth_Session AS s
      INNER JOIN dbo.Auth_Account AS a ON a.account_id = s.account_id
      LEFT JOIN dbo.Citizen AS c ON c.citizen_id = a.citizen_id
      LEFT JOIN dbo.Staff AS st ON st.staff_id = a.staff_id
      LEFT JOIN dbo.Department AS d ON d.dept_id = st.dept_id
      WHERE s.token_hash = @token_hash
        AND s.revoked_at IS NULL
        AND s.expires_at > CURRENT_TIMESTAMP
        AND a.is_active = 1
    `);

  if (result.recordset.length === 0) return null;

  const row = result.recordset[0];
  if (row.account_type === 'Citizen') {
    return {
      account_id: row.account_id,
      account_type: 'Citizen',
      role_name: 'Citizen',
      citizen_id: row.citizen_id,
      full_name: row.citizen_name,
      email: row.citizen_email,
      phone: row.citizen_phone,
      address: row.citizen_address
    };
  } else {
    return {
      account_id: row.account_id,
      account_type: 'Staff',
      role_name: row.role_name, // 'Staff' or 'Admin'
      staff_id: row.staff_id,
      full_name: row.staff_name,
      email: row.staff_email,
      designation: row.designation,
      active_cases: row.active_cases,
      dept_id: row.dept_id,
      dept_name: row.dept_name
    };
  }
}

async function registerCitizen({ fullName, email, phone, address, password }, response) {
  const trimmedName = String(fullName || '').trim();
  const trimmedEmail = String(email || '').trim().toLowerCase();
  const trimmedPhone = String(phone || '').trim();
  const trimmedAddress = address ? String(address).trim() : null;

  if (!trimmedName) throw validationError('Full name is required.');
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw validationError('A valid email address is required.');
  }
  if (!trimmedPhone || !/^[+()\d\s-]{7,20}$/.test(trimmedPhone)) {
    throw validationError('A valid phone number (7 to 20 digits) is required.');
  }
  if (!password || password.length < 8) {
    throw validationError('Password must be at least 8 characters long.');
  }

  const pool = await getPool();

  // Check duplicate email
  const existing = await pool.request()
    .input('email', sql.VarChar(100), trimmedEmail)
    .query('SELECT citizen_id FROM dbo.Citizen WHERE email = @email');

  if (existing.recordset.length > 0) {
    const conflict = new Error('An account with this email address already exists.');
    conflict.statusCode = 409;
    throw conflict;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // The Citizen row and its Auth_Account row must exist together; a failure in
  // the second insert would otherwise leave an orphan citizen that blocks the
  // email address forever.
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  let citizenId;
  let accountId;
  try {
    const citResult = await transaction.request()
      .input('full_name', sql.VarChar(100), trimmedName)
      .input('email', sql.VarChar(100), trimmedEmail)
      .input('phone', sql.VarChar(20), trimmedPhone)
      .input('address', sql.VarChar(255), trimmedAddress)
      .query(`
        INSERT INTO dbo.Citizen (full_name, email, phone, address, registered_at)
        OUTPUT INSERTED.citizen_id
        VALUES (@full_name, @email, @phone, @address, CURRENT_TIMESTAMP)
      `);

    citizenId = citResult.recordset[0].citizen_id;

    const accResult = await transaction.request()
      .input('account_type', sql.VarChar(20), 'Citizen')
      .input('citizen_id', sql.Int, citizenId)
      .input('password_hash', sql.VarChar(255), passwordHash)
      .input('role_name', sql.VarChar(20), 'Citizen')
      .query(`
        INSERT INTO dbo.Auth_Account (account_type, citizen_id, password_hash, role_name, is_active)
        OUTPUT INSERTED.account_id
        VALUES (@account_type, @citizen_id, @password_hash, @role_name, 1)
      `);

    accountId = accResult.recordset[0].account_id;
    await transaction.commit();
  } catch (insertError) {
    await transaction.rollback();

    // 2601 / 2627 are SQL Server unique / primary key violations.
    if (insertError.number === 2601 || insertError.number === 2627) {
      const conflict = new Error('An account with this email address already exists.');
      conflict.statusCode = 409;
      throw conflict;
    }
    throw insertError;
  }

  // Issue session
  await createSession(accountId, response);

  await writeAuditLog('REGISTER', 'Citizen', citizenId, `Citizen registered: ${trimmedEmail}`, 'Citizen Auth');

  return {
    citizen_id: citizenId,
    full_name: trimmedName,
    email: trimmedEmail,
    role_name: 'Citizen',
    account_type: 'Citizen'
  };
}

async function loginCitizen({ email, password }, response) {
  const trimmedEmail = String(email || '').trim().toLowerCase();
  if (!trimmedEmail || !password) {
    const err = new Error('Email and password are required.');
    err.statusCode = 400;
    throw err;
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('email', sql.VarChar(100), trimmedEmail)
    .query(`
      SELECT TOP 1
        a.account_id, a.password_hash, a.is_active,
        c.citizen_id, c.full_name, c.email, c.phone, c.address
      FROM dbo.Auth_Account AS a
      INNER JOIN dbo.Citizen AS c ON c.citizen_id = a.citizen_id
      WHERE c.email = @email AND a.account_type = 'Citizen'
    `);

  if (result.recordset.length === 0) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }

  const account = result.recordset[0];
  if (!account.is_active) {
    const err = new Error('This account has been deactivated. Please contact support.');
    err.statusCode = 403;
    throw err;
  }

  // A citizen created by another route may have no usable password.
  if (!account.password_hash) {
    const err = new Error('This account has no password set. Use the registration flow to create one.');
    err.statusCode = 403;
    throw err;
  }

  const match = await bcrypt.compare(password, account.password_hash);
  if (!match) {
    const err = new Error('Invalid email or password.');
    err.statusCode = 401;
    throw err;
  }
  await createSession(account.account_id, response);
  await writeAuditLog('LOGIN', 'Auth_Account', account.account_id, `Citizen login: ${trimmedEmail}`, 'Citizen Auth');

  return {
    citizen_id: account.citizen_id,
    full_name: account.full_name,
    email: account.email,
    phone: account.phone,
    address: account.address,
    role_name: 'Citizen',
    account_type: 'Citizen'
  };
}

async function loginStaff({ email, password }, response) {
  const trimmedEmail = String(email || '').trim().toLowerCase();
  if (!trimmedEmail || !password) {
    const err = new Error('Email and password are required.');
    err.statusCode = 400;
    throw err;
  }

  const pool = await getPool();
  const result = await pool.request()
    .input('email', sql.VarChar(100), trimmedEmail)
    .query(`
      SELECT TOP 1
        a.account_id, a.password_hash, a.role_name, a.is_active,
        s.staff_id, s.full_name, s.email, s.designation, s.active_cases,
        d.dept_id, d.dept_name
      FROM dbo.Auth_Account AS a
      INNER JOIN dbo.Staff AS s ON s.staff_id = a.staff_id
      LEFT JOIN dbo.Department AS d ON d.dept_id = s.dept_id
      WHERE s.email = @email AND a.account_type = 'Staff'
    `);

  if (result.recordset.length === 0) {
    const err = new Error('Invalid staff credentials.');
    err.statusCode = 401;
    throw err;
  }

  const staff = result.recordset[0];
  if (!staff.is_active) {
    const err = new Error('This staff account has been deactivated by an administrator.');
    err.statusCode = 403;
    throw err;
  }

  if (!staff.password_hash) {
    const err = new Error('This staff account has no password set. Ask an administrator to provision it.');
    err.statusCode = 403;
    throw err;
  }

  const match = await bcrypt.compare(password, staff.password_hash);
  if (!match) {
    const err = new Error('Invalid staff credentials.');
    err.statusCode = 401;
    throw err;
  }

  await createSession(staff.account_id, response);  await writeAuditLog('LOGIN', 'Staff', staff.staff_id, `Staff login: ${trimmedEmail} (${staff.role_name})`, 'Staff Auth');

  return {
    staff_id: staff.staff_id,
    full_name: staff.full_name,
    email: staff.email,
    designation: staff.designation,
    active_cases: staff.active_cases,
    dept_id: staff.dept_id,
    dept_name: staff.dept_name,
    role_name: staff.role_name,
    account_type: 'Staff'
  };
}

async function completeGoogleLogin({ email, name }, response) {
  const normalizedEmail = email.trim().toLowerCase();
  const pool = await getPool();

  // Find existing citizen or create one
  let citizenRecord = await pool.request()
    .input('email', sql.VarChar(100), normalizedEmail)
    .query('SELECT citizen_id, full_name, email, phone, address FROM dbo.Citizen WHERE email = @email');

  let citizenId;
  let fullName = name || normalizedEmail.split('@')[0];

  if (citizenRecord.recordset.length === 0) {
    const insertCit = await pool.request()
      .input('full_name', sql.VarChar(100), fullName)
      .input('email', sql.VarChar(100), normalizedEmail)
      .input('phone', sql.VarChar(20), '+1-000-000-0000')
      .input('address', sql.VarChar(255), 'Google Verified Account')
      .query(`
        INSERT INTO dbo.Citizen (full_name, email, phone, address)
        OUTPUT INSERTED.citizen_id
        VALUES (@full_name, @email, @phone, @address)
      `);
    citizenId = insertCit.recordset[0].citizen_id;
  } else {
    citizenId = citizenRecord.recordset[0].citizen_id;
    fullName = citizenRecord.recordset[0].full_name;
  }

  // Ensure Auth_Account exists
  let account = await pool.request()
    .input('citizen_id', sql.Int, citizenId)
    .query('SELECT account_id, is_active FROM dbo.Auth_Account WHERE citizen_id = @citizen_id');

  let accountId;
  if (account.recordset.length === 0) {
    // Generate secure random fallback hash
    const randomSecret = crypto.randomBytes(32).toString('hex');
    const hash = await bcrypt.hash(randomSecret, 12);
    const insertAcc = await pool.request()
      .input('citizen_id', sql.Int, citizenId)
      .input('password_hash', sql.VarChar(255), hash)
      .query(`
        INSERT INTO dbo.Auth_Account (account_type, citizen_id, password_hash, role_name, is_active)
        OUTPUT INSERTED.account_id
        VALUES ('Citizen', @citizen_id, @password_hash, 'Citizen', 1)
      `);
    accountId = insertAcc.recordset[0].account_id;
  } else {
    if (!account.recordset[0].is_active) {
      const err = new Error('This account has been deactivated.');
      err.statusCode = 403;
      throw err;
    }
    accountId = account.recordset[0].account_id;
  }

  await createSession(accountId, response);
  await writeAuditLog('LOGIN', 'Citizen', citizenId, `Google OAuth + OTP Login: ${normalizedEmail}`, 'Google Auth');

  return {
    citizen_id: citizenId,
    full_name: fullName,
    email: normalizedEmail,
    role_name: 'Citizen',
    account_type: 'Citizen'
  };
}

async function logout(token, response) {
  if (token) {
    const tokenBinary = hashToken(token);
    const pool = await getPool();
    await pool.request()
      .input('token_hash', sql.VarBinary(64), tokenBinary)
      .query('UPDATE dbo.Auth_Session SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = @token_hash');
  }
  clearSessionCookie(response);
}

module.exports = {
  registerCitizen,
  loginCitizen,
  loginStaff,
  completeGoogleLogin,
  getUserFromToken,
  logout
};
