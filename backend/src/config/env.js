const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Single source of truth for backend configuration.
// backend/.env is authoritative. If it is missing, fall back to the repository
// root .env so a fresh clone with only a root .env still boots, and say so once.
const backendEnvPath = path.join(__dirname, '../../.env');
const rootEnvPath = path.join(__dirname, '../../../.env');

let loadedEnvPath = null;
if (fs.existsSync(backendEnvPath)) {
  loadedEnvPath = backendEnvPath;
} else if (fs.existsSync(rootEnvPath)) {
  loadedEnvPath = rootEnvPath;
  console.warn(`[env] backend/.env not found; falling back to ${rootEnvPath}`);
} else {
  // No file at all: rely on the process environment only.
  loadedEnvPath = null;
  console.warn('[env] No .env file found; using process environment variables only.');
}

if (loadedEnvPath) {
  dotenv.config({ path: loadedEnvPath });
}

function boolFrom(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).trim().toLowerCase() === 'true' || String(value).trim() === '1';
}

// DB_AUTH selects the authentication mode explicitly:
//   'windows' (default) -> Windows Integrated / Trusted Connection
//   'sql'               -> SQL Server login using DB_USER + DB_PASSWORD
// DB_TRUSTED_CONNECTION is supported for compatibility with the existing env
// file and is used only when DB_AUTH is not set.
const DB_AUTH = (
  process.env.DB_AUTH ||
  (boolFrom(process.env.DB_TRUSTED_CONNECTION, true) ? 'windows' : 'sql')
).trim().toLowerCase();

function normalizeAuthMode(mode) {
  if (mode === 'sql' || mode === 'windows') return mode;
  throw new Error(
    `Invalid DB_AUTH "${mode}". Use "windows" for Windows Integrated Authentication ` +
    'or "sql" for SQL Server authentication.'
  );
}

const authMode = normalizeAuthMode(DB_AUTH);

const config = {
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV: (process.env.NODE_ENV || 'development').trim(),
  LOADED_ENV_PATH: loadedEnvPath,

  // Database
  DB_SERVER: (process.env.DB_SERVER || '').trim(),
  DB_DATABASE: (process.env.DB_DATABASE || '').trim(),
  DB_PORT: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  DB_ODBC_DRIVER: (process.env.DB_ODBC_DRIVER || 'ODBC Driver 18 for SQL Server').trim(),
  DB_TRUST_SERVER_CERTIFICATE: boolFrom(process.env.DB_TRUST_SERVER_CERTIFICATE, true),
  DB_TRUSTED_CONNECTION: boolFrom(process.env.DB_TRUSTED_CONNECTION, true),
  DB_AUTH: authMode,
  // Only consumed when DB_AUTH === 'sql'. Never logged or echoed by this module.
  DB_USER: (process.env.DB_USER || '').trim(),
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_ENCRYPT: boolFrom(process.env.DB_ENCRYPT, true),
  DB_CONNECTION_TIMEOUT_MS: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 15000),
  DB_REQUEST_TIMEOUT_MS: Number(process.env.DB_REQUEST_TIMEOUT_MS || 30000),
  DB_POOL_MAX: Number(process.env.DB_POOL_MAX || 5),

  // CORS: origins allowed to call the API with credentials.
  CORS_EXTRA_ORIGINS: (process.env.CORS_EXTRA_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean),

  // Session
  SESSION_COOKIE_NAME: 'citywatch_session',
  SESSION_MAX_AGE_MS: 8 * 60 * 60 * 1000, // 8 hours

  // Google OAuth
  GOOGLE_CLIENT_ID: (process.env.GOOGLE_CLIENT_ID || '').trim(),

  // SMTP Configuration
  SMTP_HOST: (process.env.SMTP_HOST || '').trim(),
  SMTP_PORT: Number(process.env.SMTP_PORT || 587),
  SMTP_USER: (process.env.SMTP_USER || '').trim(),
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: (process.env.SMTP_FROM || 'CityWatch Civic Support <noreply@citywatch.gov>').trim(),

  // Uploads
  UPLOAD_DIR: path.join(__dirname, '../../uploads'),
  MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024 // 5 MB
};

// Derived capability flags: features are only advertised as available when the
// credentials they need are actually present. Nothing here is a secret.
config.googleOAuthEnabled = Boolean(config.GOOGLE_CLIENT_ID);
config.emailOtpEnabled = Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS);

// Non-secret description of the active database target, safe for /api/health.
config.dbTarget = {
  server: config.DB_PORT ? `${config.DB_SERVER},${config.DB_PORT}` : config.DB_SERVER,
  database: config.DB_DATABASE,
  driver: config.DB_ODBC_DRIVER,
  authentication: config.DB_AUTH === 'sql' ? 'SQL Server authentication' : 'Windows Integrated Authentication'
};

/**
 * Fail fast with an actionable message when the database target is not
 * configured, instead of letting a malformed connection string reach the driver.
 */
function assertDatabaseConfigured() {
  const missing = [];
  if (!config.DB_SERVER) missing.push('DB_SERVER');
  if (!config.DB_DATABASE) missing.push('DB_DATABASE');
  if (config.DB_AUTH === 'sql' && !config.DB_USER) missing.push('DB_USER');
  if (config.DB_AUTH === 'sql' && !config.DB_PASSWORD) missing.push('DB_PASSWORD');

  if (missing.length > 0) {
    throw new Error(
      `Database connection is not configured. Missing ${missing.join(', ')} in ` +
      `${loadedEnvPath || 'the process environment'}. See backend/.env.example.`
    );
  }
}

module.exports = {
  ...config,
  assertDatabaseConfigured
};
