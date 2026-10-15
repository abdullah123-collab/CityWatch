const { getPool, describeError } = require('../backend/src/config/db');

(async () => {
  const pool = await getPool();

  const staff = await pool.request().query(`
    SELECT s.staff_id, s.full_name, s.email, s.dept_id, d.dept_name, s.active_cases,
           a.account_id, a.role_name, a.is_active,
           LEN(ISNULL(a.password_hash,'')) AS hash_len
    FROM dbo.Staff s
    INNER JOIN dbo.Department d ON d.dept_id = s.dept_id
    LEFT JOIN dbo.Auth_Account a ON a.staff_id = s.staff_id
    ORDER BY s.staff_id
  `);
  console.log('=== STAFF vs AUTH_ACCOUNT ===');
  console.table(staff.recordset);

  const depts = await pool.request().query('SELECT dept_id, dept_name, category FROM dbo.Department ORDER BY dept_id');
  console.log('\n=== DEPARTMENTS ===');
  console.table(depts.recordset);

  const complaints = await pool.request().query(`
    SELECT complaint_id, citizen_id, dept_id, staff_id, status, priority,
           LEFT(title, 40) AS title
    FROM dbo.Complaint ORDER BY complaint_id
  `);
  console.log('\n=== COMPLAINTS ===');
  console.table(complaints.recordset);

  const constraints = await pool.request().query(`
    SELECT parent.name AS table_name, fk.name AS constraint_name,
           referenced.name AS referenced_table, fk.delete_action
    FROM sys.foreign_keys fk
    JOIN sys.tables parent ON parent.object_id = fk.parent_object_id
    JOIN sys.tables referenced ON referenced.object_id = fk.referenced_object_id
    ORDER BY parent.name
  `);
  console.log('\n=== FOREIGN KEYS ===');
  console.table(constraints.recordset);

  const indexes = await pool.request().query(`
    SELECT t.name AS table_name, i.name AS index_name, i.is_unique
    FROM sys.indexes i JOIN sys.tables t ON t.object_id = i.object_id
    WHERE i.name IS NOT NULL AND i.is_unique = 1
    ORDER BY t.name
  `);
  console.log('\n=== UNIQUE INDEXES / PKs ===');
  console.table(indexes.recordset);

  process.exit(0);
})().catch(e => { console.error('ERR', describeError(e)); process.exit(1); });
