const { sql, getPool } = require('../config/db');

async function writeAuditLog(operationType, tableName, recordId, details, actionBy = 'CityWatch API') {
  try {
    const pool = await getPool();
    const actionType = ['INSERT', 'UPDATE', 'DELETE'].includes(operationType)
      ? operationType
      : 'INSERT';
    const actionDetails = `[${operationType}] ${details || ''}`.slice(0, 1000);

    await pool.request()
      .input('action_type', sql.VarChar(20), actionType)
      .input('table_name', sql.VarChar(100), tableName || null)
      .input('record_id', sql.Int, recordId ? Number(recordId) : null)
      .input('action_details', sql.VarChar(1000), actionDetails)
      .input('action_by', sql.VarChar(100), String(actionBy).slice(0, 100))
      .query(`
        INSERT INTO dbo.Audit_Log
          (action_type, table_name, record_id, action_details, action_by)
        VALUES (@action_type, @table_name, @record_id, @action_details, @action_by)
      `);
  } catch (auditError) {
    console.error('[Audit_Log Warning]', auditError.message || auditError);
  }
}

module.exports = {
  writeAuditLog
};
