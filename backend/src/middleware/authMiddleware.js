const { getUserFromToken } = require('../services/authService');
const env = require('../config/env');

function parseCookies(request) {
  const cookieHeader = request.headers.cookie || '';
  return Object.fromEntries(
    cookieHeader
      .split(';')
      .filter(Boolean)
      .map(part => {
        const index = part.indexOf('=');
        if (index === -1) return [part.trim(), ''];
        return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

async function requireAuth(req, res, next) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[env.SESSION_COOKIE_NAME];

    if (!token) {
      return res.status(401).json({ error: 'Authentication is required. Please sign in.' });
    }

    const user = await getUserFromToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Your session has expired or is invalid. Please sign in again.' });
    }

    req.user = user;
    req.sessionToken = token;
    next();
  } catch (err) {
    console.error('[Auth Middleware Error]', err.message || err);
    res.status(500).json({ error: 'Failed to verify session.' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({ error: 'You do not have permission to access this resource.' });
    }
    next();
  };
}

const requireCitizen = [requireAuth, requireRole('Citizen')];
const requireStaff = [requireAuth, requireRole('Staff', 'Admin')];
const requireAdmin = [requireAuth, requireRole('Admin')];

module.exports = {
  parseCookies,
  requireAuth,
  requireRole,
  requireCitizen,
  requireStaff,
  requireAdmin
};
