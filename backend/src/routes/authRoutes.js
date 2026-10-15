const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const otpService = require('../services/otpService');
const googleAuthService = require('../services/googleAuthService');
const { requireAuth, parseCookies } = require('../middleware/authMiddleware');
const env = require('../config/env');

// GET /api/auth/config
// Lets the portals report truthfully which sign-in methods this server can
// actually complete, instead of showing controls that are guaranteed to fail.
router.get('/config', (req, res) => {
  res.json({
    passwordAuth: true,
    googleOAuth: env.googleOAuthEnabled,
    emailOtp: env.emailOtpEnabled,
    googleOAuthReason: env.googleOAuthEnabled
      ? null
      : 'GOOGLE_CLIENT_ID is not configured in backend/.env.',
    emailOtpReason: env.emailOtpEnabled
      ? null
      : 'SMTP_HOST, SMTP_USER and SMTP_PASS are not configured in backend/.env.'
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { fullName, email, phone, address, password } = req.body;
    const user = await authService.registerCitizen({ fullName, email, phone, address, password }, res);
    res.status(201).json({ user, message: 'Registration successful!' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await authService.loginCitizen({ email, password }, res);
    res.json({ user, message: 'Signed in successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/staff-login
router.post('/staff-login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await authService.loginStaff({ email, password }, res);
    res.json({ user, message: 'Staff authenticated successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/google/initiate
// Step 1 & 2 of Google Flow: Verifies Google Identity and issues Email OTP
router.post('/google/initiate', async (req, res, next) => {
  try {
    // Report the real blocker up front rather than failing halfway through the
    // two-factor sequence.
    const missing = [];
    if (!env.googleOAuthEnabled) missing.push('GOOGLE_CLIENT_ID');
    if (!env.emailOtpEnabled) missing.push('SMTP_HOST, SMTP_USER, SMTP_PASS');
    if (missing.length > 0) {
      const err = new Error(
        `Google sign-in is not available on this server because ${missing.join(' and ')} ` +
        'are not configured in backend/.env. Email and password sign-in still works.'
      );
      err.statusCode = 503;
      throw err;
    }

    const { idToken } = req.body;
    if (!idToken) {
      const err = new Error('Google Identity Token is required.');
      err.statusCode = 400;
      throw err;
    }

    // Verify token with Google
    const googleUser = await googleAuthService.verifyGoogleToken(idToken);

    // Generate cryptographic OTP and send to verified email
    const otpResult = await otpService.generateAndSendOtp(googleUser.email);

    res.json({
      success: true,
      email: googleUser.email,
      name: googleUser.name,
      message: `A verification code has been sent to ${googleUser.email}. Please enter it within 5 minutes.`,
      expiresInSeconds: otpResult.expiresInSeconds
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/google/verify-otp
// Step 3 of Google Flow: Verifies OTP code and establishes application session
router.post('/google/verify-otp', async (req, res, next) => {
  try {
    const { email, otpCode, name } = req.body;
    if (!email || !otpCode) {
      const err = new Error('Email address and verification code are required.');
      err.statusCode = 400;
      throw err;
    }

    // Verify OTP against hashed record in SQL Server
    await otpService.verifyOtp(email, otpCode);

    // Create / link citizen record and issue session
    const user = await authService.completeGoogleLogin({ email, name }, res);

    res.json({
      success: true,
      user,
      message: 'Email OTP verified successfully. Welcome to CityWatch!'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    const cookies = parseCookies(req);
    const token = cookies[env.SESSION_COOKIE_NAME];
    await authService.logout(token, res);
    res.status(200).json({ message: 'Signed out successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
