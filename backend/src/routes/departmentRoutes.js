const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');

// GET /api/departments - Public department listing
router.get('/', async (req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT dept_id, dept_name, category, contact_email, contact_phone, head_officer
      FROM dbo.Department
      ORDER BY dept_name ASC
    `);
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
