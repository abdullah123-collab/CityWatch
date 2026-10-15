const express = require('express');
const router = express.Router();
const { verifyDatabaseConnection } = require('../config/db');
const env = require('../config/env');

// GET /api/diagnostics/database
// Performs a real round-trip so a live API process can never be mistaken for a
// working database connection. Reports no credentials.
router.get('/database', async (req, res) => {
  const database = await verifyDatabaseConnection();

  const payload = {
    connected: database.reachable,
    server: database.server,
    database: database.database,
    actualDatabase: database.actualDatabase || null,
    driver: database.driver,
    authentication: database.authentication,
    serverVersion: database.serverVersion,
    latencyMs: database.latencyMs,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString()
  };

  if (database.reachable) {
    return res.json(payload);
  }

  payload.error = database.error || 'Database is not reachable.';
  return res.status(503).json(payload);
});

// GET /api/diagnostics/tables
// Confirms the application's expected tables actually exist in the connected
// database, which is the usual cause of "server is up but every query fails".
router.get('/tables', async (req, res) => {
  const expected = [
    'Citizen', 'Location', 'Department', 'Staff', 'Complaint', 'Complaint_History',
    'Feedback', 'Audit_Log', 'Auth_Account', 'Auth_Session', 'Auth_OTP', 'Complaint_Attachment'
  ];

  try {
    const { getPool } = require('../config/db');
    const pool = await getPool();
    const result = await pool.request().query(
      "SELECT name FROM sys.tables WHERE type = 'U' AND schema_id = SCHEMA_ID('dbo')"
    );
    const present = new Set(result.recordset.map(row => row.name));
    const missing = expected.filter(name => !present.has(name));

    return res.json({
      connected: true,
      database: env.DB_DATABASE,
      present: expected.filter(name => present.has(name)),
      missing,
      ok: missing.length === 0
    });
  } catch (error) {
    const { describeError } = require('../config/db');
    return res.status(503).json({ connected: false, error: describeError(error) });
  }
});

module.exports = router;
