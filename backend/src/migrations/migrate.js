const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { sql, getConnectionString } = require('../config/db');

async function migrate() {
  env.assertDatabaseConfigured();
  console.log(
    '[Migration] Connecting to SQL Server on',
    env.dbTarget.server,
    'Database:',
    env.dbTarget.database
  );
  const pool = await sql.connect({
    connectionString: getConnectionString(),
    driver: 'msnodesqlv8',
    options: {
      trustedConnection: env.DB_AUTH !== 'sql',
      trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE
    },
    connectionTimeout: env.DB_CONNECTION_TIMEOUT_MS,
    requestTimeout: env.DB_REQUEST_TIMEOUT_MS
  });

  try {
    // 1. Run safe SQL migrations
    await pool.request().query(`
      IF OBJECT_ID('dbo.Complaint_Attachment', 'U') IS NULL
      BEGIN
          CREATE TABLE dbo.Complaint_Attachment (
              attachment_id  INT IDENTITY(1,1) PRIMARY KEY,
              complaint_id   INT NOT NULL,
              file_name      VARCHAR(255) NOT NULL,
              stored_name    VARCHAR(255) NOT NULL,
              file_path      VARCHAR(500) NOT NULL,
              file_size      INT NOT NULL,
              mime_type      VARCHAR(100) NOT NULL,
              uploaded_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              CONSTRAINT FK_Complaint_Attachment FOREIGN KEY (complaint_id)
                  REFERENCES dbo.Complaint(complaint_id) ON DELETE CASCADE
          );
      END
    `);

    await pool.request().query(`
      IF OBJECT_ID('dbo.Auth_OTP', 'U') IS NULL
      BEGIN
          CREATE TABLE dbo.Auth_OTP (
              otp_id       INT IDENTITY(1,1) PRIMARY KEY,
              email        VARCHAR(100) NOT NULL,
              otp_hash     VARBINARY(64) NOT NULL,
              attempts     INT NOT NULL DEFAULT 0,
              expires_at   DATETIME NOT NULL,
              created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
              consumed_at  DATETIME NULL
          );
          CREATE INDEX IX_Auth_OTP_lookup ON dbo.Auth_OTP(email, expires_at, consumed_at);
      END
    `);
    console.log('[Migration] Schema migration checked and verified.');

    // 2. Ensure Admin staff record exists
    const adminStaffEmail = 'admin@citywatch.gov';
    let adminStaff = await pool.request()
      .input('email', sql.VarChar(100), adminStaffEmail)
      .query('SELECT staff_id, full_name FROM dbo.Staff WHERE email = @email');

    let adminStaffId;
    if (adminStaff.recordset.length === 0) {
      const inserted = await pool.request()
        .input('dept_id', sql.Int, 1)
        .input('full_name', sql.VarChar(100), 'Chief Administrator')
        .input('designation', sql.VarChar(80), 'Municipal Administrator')
        .input('email', sql.VarChar(100), adminStaffEmail)
        .input('phone', sql.VarChar(20), '+1-800-CITY-ADM')
        .input('joined_at', sql.Date, new Date('2023-01-01'))
        .input('active_cases', sql.Int, 0)
        .query(`
          INSERT INTO dbo.Staff (dept_id, full_name, designation, email, phone, joined_at, active_cases)
          OUTPUT INSERTED.staff_id
          VALUES (@dept_id, @full_name, @designation, @email, @phone, @joined_at, @active_cases)
        `);
      adminStaffId = inserted.recordset[0].staff_id;
      console.log('[Migration] Provisioned Admin staff record, ID:', adminStaffId);
    } else {
      adminStaffId = adminStaff.recordset[0].staff_id;
      console.log('[Migration] Found existing Admin staff record, ID:', adminStaffId);
    }

    // 3. Ensure Admin Auth_Account exists
    const adminAccount = await pool.request()
      .input('staff_id', sql.Int, adminStaffId)
      .query('SELECT account_id FROM dbo.Auth_Account WHERE staff_id = @staff_id');

    if (adminAccount.recordset.length === 0) {
      const adminHash = await bcrypt.hash('AdminPass123!', 10);
      await pool.request()
        .input('staff_id', sql.Int, adminStaffId)
        .input('password_hash', sql.VarChar(255), adminHash)
        .query(`
          INSERT INTO dbo.Auth_Account (account_type, staff_id, password_hash, role_name, is_active)
          VALUES ('Staff', @staff_id, @password_hash, 'Admin', 1)
        `);
      console.log('[Migration] Provisioned Admin Auth_Account: admin@citywatch.gov / AdminPass123!');
    } else {
      console.log('[Migration] Admin Auth_Account already exists.');
    }

    // 4. Ensure all Staff members have Auth_Account
    const staffMembers = await pool.request()
      .query("SELECT staff_id, full_name, email FROM dbo.Staff WHERE email <> 'admin@citywatch.gov'");

    const defaultStaffHash = await bcrypt.hash('StaffPass123!', 10);
    for (const member of staffMembers.recordset) {
      const acc = await pool.request()
        .input('staff_id', sql.Int, member.staff_id)
        .query('SELECT account_id FROM dbo.Auth_Account WHERE staff_id = @staff_id');

      if (acc.recordset.length === 0) {
        await pool.request()
          .input('staff_id', sql.Int, member.staff_id)
          .input('password_hash', sql.VarChar(255), defaultStaffHash)
          .query(`
            INSERT INTO dbo.Auth_Account (account_type, staff_id, password_hash, role_name, is_active)
            VALUES ('Staff', @staff_id, @password_hash, 'Staff', 1)
          `);
        console.log(`[Migration] Provisioned Auth_Account for staff ${member.email} / StaffPass123!`);
      }
    }

    // 5. Ensure existing citizens have Auth_Account for testing
    const citizens = await pool.request().query('SELECT citizen_id, full_name, email FROM dbo.Citizen');
    const defaultCitizenHash = await bcrypt.hash('Citizen123!', 10);
    for (const citizen of citizens.recordset) {
      const acc = await pool.request()
        .input('citizen_id', sql.Int, citizen.citizen_id)
        .query('SELECT account_id FROM dbo.Auth_Account WHERE citizen_id = @citizen_id');

      if (acc.recordset.length === 0) {
        await pool.request()
          .input('citizen_id', sql.Int, citizen.citizen_id)
          .input('password_hash', sql.VarChar(255), defaultCitizenHash)
          .query(`
            INSERT INTO dbo.Auth_Account (account_type, citizen_id, password_hash, role_name, is_active)
            VALUES ('Citizen', @citizen_id, @password_hash, 'Citizen', 1)
          `);
        console.log(`[Migration] Provisioned Auth_Account for citizen ${citizen.email} / Citizen123!`);
      }
    }

    console.log('[Migration] Database migration & provisioning completed successfully.');
  } finally {
    // Keep connection alive for exit
    setTimeout(() => process.exit(0), 100);
  }
}

migrate().catch(err => {
  console.error('[Migration] Failed:', err);
  process.exit(1);
});
