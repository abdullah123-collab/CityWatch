const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const { verifyDatabaseConnection, describeError } = require('./config/db');

// Route imports
const authRoutes = require('./routes/authRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const staffRoutes = require('./routes/staffRoutes');
const adminRoutes = require('./routes/adminRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const diagnosticRoutes = require('./routes/diagnosticRoutes');

const app = express();

// The three Vite portals run on 5173/5174/5175 and send session cookies, so
// credentialed cross-origin requests must be allowed for exactly those origins.
// Additional origins (e.g. a tunneled preview) can be added with
// CORS_EXTRA_ORIGINS=https://host; nothing is allowed implicitly.
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  ...env.CORS_EXTRA_ORIGINS
]);

app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header (curl, Postman, same-origin navigation,
    // health probes) are not browser cross-origin requests and stay allowed.
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    return callback(new Error(`Origin ${origin} is not allowed by CORS policy.`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check: reports the API and the database independently. `status` is
// only "ok" when a real SQL Server round-trip succeeded.
app.get('/api/health', async (req, res) => {
  const database = await verifyDatabaseConnection();
  res.status(database.reachable ? 200 : 503).json({
    status: database.reachable ? 'ok' : 'degraded',
    service: 'CityWatch Municipal API',
    time: new Date().toISOString(),
    api: { listening: true, environment: env.NODE_ENV },
    database: {
      reachable: database.reachable,
      server: database.server,
      database: database.database,
      actualDatabase: database.actualDatabase || null,
      driver: database.driver,
      authentication: database.authentication,
      serverVersion: database.serverVersion,
      latencyMs: database.latencyMs,
      error: database.error
    }
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/diagnostics', diagnosticRoutes);

// Anything else under /api is a client mistake, not a silent 404 HTML page.
app.use('/api', (req, res) => {
  res.status(404).json({
    error: `Unknown API endpoint: ${req.method} ${req.originalUrl}`,
    statusCode: 404
  });
});

// Centralized error handling middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // CORS rejections must not be reported as generic server faults.
  if (err && /not allowed by CORS policy/.test(err.message || '')) {
    return res.status(403).json({ error: err.message, statusCode: 403 });
  }

  // Multer errors carry useful text but default to a 500.
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: `Uploaded file exceeds the ${Math.round(env.MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB limit.`,
      statusCode: 413
    });
  }

  const rawMessage = describeError(err);
  const statusCode = err.statusCode || (typeof err.status === 'number' ? err.status : 500);

  if (statusCode >= 500) {
    // Log the real driver text (never credentials: describeError only returns
    // driver messages, and connection strings are not part of them).
    console.error(`[Server Error ${statusCode}] ${req.method} ${req.originalUrl} ->`, rawMessage);
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'A server error occurred. Please try again or contact support.' : rawMessage,
    statusCode,
    // Surface the underlying database failure reason so an operator can act on it.
    ...(statusCode === 503 ? { details: rawMessage } : {})
  });
});

module.exports = app;
