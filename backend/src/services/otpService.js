const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { sql, getPool } = require('../config/db');
const env = require('../config/env');

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest();
}

function getMailTransporter() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });
}

/**
 * Creates and records a cryptographically secure 6-digit OTP, expiring in 5 minutes.
 * Sends the OTP via Nodemailer if SMTP is configured.
 */
async function generateAndSendOtp(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const pool = await getPool();

  // Cooldown check: reject if another OTP was issued in the last 60 seconds
  const recentCheck = await pool.request()
    .input('email', sql.VarChar(100), normalizedEmail)
    .query(`
      SELECT TOP 1 created_at
      FROM dbo.Auth_OTP
      WHERE email = @email AND consumed_at IS NULL
      ORDER BY created_at DESC
    `);

  if (recentCheck.recordset.length > 0) {
    const elapsedMs = Date.now() - new Date(recentCheck.recordset[0].created_at).getTime();
    if (elapsedMs < 60000) {
      const waitSeconds = Math.ceil((60000 - elapsedMs) / 1000);
      const cooldownError = new Error(`Please wait ${waitSeconds} seconds before requesting a new code.`);
      cooldownError.statusCode = 429;
      throw cooldownError;
    }
  }

  // Generate 6-digit cryptographic OTP
  const rawOtp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = hashOtp(rawOtp);

  // Invalidate any old unconsumed OTPs for this email
  await pool.request()
    .input('email', sql.VarChar(100), normalizedEmail)
    .query(`
      UPDATE dbo.Auth_OTP
      SET consumed_at = CURRENT_TIMESTAMP
      WHERE email = @email AND consumed_at IS NULL
    `);

  // Insert into Auth_OTP with 5-minute expiry
  await pool.request()
    .input('email', sql.VarChar(100), normalizedEmail)
    .input('otp_hash', sql.VarBinary(64), otpHash)
    .query(`
      INSERT INTO dbo.Auth_OTP (email, otp_hash, attempts, expires_at, created_at)
      VALUES (@email, @otp_hash, 0, DATEADD(MINUTE, 5, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
    `);

  // Dispatch email if SMTP configured
  const transporter = getMailTransporter();
  if (!transporter) {
    const smtpError = new Error(
      'Email verification service is not fully configured on the server. ' +
      'Please configure SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS in the backend environment file.'
    );
    smtpError.statusCode = 503;
    throw smtpError;
  }

  try {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: normalizedEmail,
      subject: 'CityWatch — Verification Code',
      text: `Your CityWatch one-time verification code is: ${rawOtp}. This code expires in 5 minutes. Do not share it with anyone.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; background-color: #f8fafc; color: #0f172a;">
          <h2 style="color: #1e3a8a;">CityWatch Civic Platform</h2>
          <p>You requested verification to sign in with your Google account.</p>
          <div style="margin: 24px 0; padding: 16px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e3a8a;">${rawOtp}</span>
          </div>
          <p style="color: #64748b; font-size: 14px;">This code will expire in <strong>5 minutes</strong>. If you did not initiate this request, you may safely ignore this email.</p>
        </div>
      `
    });
  } catch (mailError) {
    console.error('[OTP Email Delivery Error]', mailError.message || mailError);
    const sendError = new Error('Failed to send verification code to your email address. Please try again.');
    sendError.statusCode = 502;
    throw sendError;
  }

  return { email: normalizedEmail, expiresInSeconds: 300 };
}

/**
 * Validates the provided OTP code against the stored hash.
 * Enforces:
 * - Expiration (~5 minutes)
 * - Maximum 5 attempts
 * - Invalidation after successful verification
 */
async function verifyOtp(email, otpCode) {
  const normalizedEmail = email.trim().toLowerCase();
  const pool = await getPool();

  const record = await pool.request()
    .input('email', sql.VarChar(100), normalizedEmail)
    .query(`
      SELECT TOP 1 otp_id, otp_hash, attempts, expires_at, consumed_at
      FROM dbo.Auth_OTP
      WHERE email = @email AND consumed_at IS NULL
      ORDER BY created_at DESC
    `);

  if (record.recordset.length === 0) {
    const notFoundError = new Error('No active verification code found for this email. Please request a new code.');
    notFoundError.statusCode = 400;
    throw notFoundError;
  }

  const { otp_id, otp_hash, attempts, expires_at } = record.recordset[0];

  // Check expiration
  if (new Date() > new Date(expires_at)) {
    await pool.request()
      .input('otp_id', sql.Int, otp_id)
      .query('UPDATE dbo.Auth_OTP SET consumed_at = CURRENT_TIMESTAMP WHERE otp_id = @otp_id');
    const expiredError = new Error('Verification code has expired. Please request a new code.');
    expiredError.statusCode = 400;
    throw expiredError;
  }

  // Check attempt limit
  if (attempts >= 5) {
    await pool.request()
      .input('otp_id', sql.Int, otp_id)
      .query('UPDATE dbo.Auth_OTP SET consumed_at = CURRENT_TIMESTAMP WHERE otp_id = @otp_id');
    const limitError = new Error('Too many invalid attempts. This code has been invalidated. Please request a new code.');
    limitError.statusCode = 429;
    throw limitError;
  }

  const inputHash = hashOtp(otpCode);
  const isValid = crypto.timingSafeEqual(inputHash, otp_hash);

  if (!isValid) {
    await pool.request()
      .input('otp_id', sql.Int, otp_id)
      .query('UPDATE dbo.Auth_OTP SET attempts = attempts + 1 WHERE otp_id = @otp_id');
    const mismatchError = new Error(`Invalid verification code. (${4 - attempts} attempts remaining)`);
    mismatchError.statusCode = 400;
    throw mismatchError;
  }

  // Invalidate code upon successful verification
  await pool.request()
    .input('otp_id', sql.Int, otp_id)
    .query('UPDATE dbo.Auth_OTP SET consumed_at = CURRENT_TIMESTAMP WHERE otp_id = @otp_id');

  return true;
}

module.exports = {
  generateAndSendOtp,
  verifyOtp,
  hashOtp
};
