const { getPool } = require('../backend/src/config/db');

(async () => {
  const pool = await getPool();
  const tables = await pool.request().query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' ORDER BY TABLE_NAME"
  );
  console.log('=== TABLES ===');
  for (const t of tables.recordset) {
    const cols = await pool.request()
      .input('n', t.TABLE_NAME)
      .query("SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMNPROPERTY(OBJECT_ID(TABLE_NAME), COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME=@n ORDER BY ORDINAL_POSITION");
    console.log(`\n--- ${t.TABLE_NAME} ---`);
    for (const c of cols.recordset) {
      const len = c.CHARACTER_MAXIMUM_LENGTH ? `(${c.CHARACTER_MAXIMUM_LENGTH})` : '';
      const idn = c.IS_IDENTITY === 1 ? ' IDENTITY' : '';
      console.log(`  ${c.COLUMN_NAME} ${c.DATA_TYPE}${len}${idn} ${c.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}`);
    }
    const cnt = await pool.request().query(`SELECT COUNT(*) AS c FROM [${t.TABLE_NAME}]`);
    console.log(`  ROWS: ${cnt.recordset[0].c}`);
  }
  process.exit(0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
