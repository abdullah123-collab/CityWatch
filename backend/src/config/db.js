const sql = require('mssql/msnodesqlv8');
const env = require('./env');

/**
 * Builds the ODBC connection string for the configured authentication mode.
 * SQL Server credentials are inserted only when DB_AUTH=sql and are never
 * returned by any diagnostic endpoint or log statement.
 */
function getConnectionString() {
  if (!env.DB_SERVER || !env.DB_DATABASE) {
    const err = new Error(
      'Database connection is not configured. Set DB_SERVER and DB_DATABASE in backend/.env.'
    );
    err.code = 'DB_NOT_CONFIGURED';
    throw err;
  }

  if (env.DB_AUTH === 'sql' && (!env.DB_USER || !env.DB_PASSWORD)) {
    const err = new Error(
      'DB_AUTH is set to "sql" but DB_USER/DB_PASSWORD are missing. ' +
      'Either provide both variables or set DB_AUTH=windows.'
    );
    err.code = 'DB_NOT_CONFIGURED';
    throw err;
  }

  const server = env.DB_PORT ? `${env.DB_SERVER},${env.DB_PORT}` : env.DB_SERVER;
  const parts = [
    `Driver={${env.DB_ODBC_DRIVER}}`,
    `Server=${server}`,
    `Database=${env.DB_DATABASE}`,
    `Encrypt=${env.DB_ENCRYPT ? 'Yes' : 'No'}`,
    `TrustServerCertificate=${env.DB_TRUST_SERVER_CERTIFICATE ? 'Yes' : 'No'}`,
    // Fail fast instead of hanging a request for the driver's default 30s+.
    `Connection Timeout=${Math.max(1, Math.ceil(env.DB_CONNECTION_TIMEOUT_MS / 1000))}`
  ];

  if (env.DB_AUTH === 'sql') {
    parts.push(`UID=${env.DB_USER}`, `PWD=${env.DB_PASSWORD}`);
  } else {
    parts.push('Trusted_Connection=Yes');
  }

  return parts.join(';') + ';';
}

/**
 * msnodesqlv8 surfaces driver failures as objects whose String() is
 * "[object Object]", which is useless in logs and API responses. This walks the
 * error and its nested details and returns the real driver messages.
 */
function describeError(error) {
  if (!error) return 'Unknown database error.';
  const collected = [];

  const push = (value) => {
    if (typeof value === 'string' && value.trim()) collected.push(value.trim());
    // msnodesqlv8 sometimes sets error.message to a plain object instead of a
    // string, causing the useless "[object Object]" in logs. Unwrap it here.
    else if (value && typeof value === 'object') push(value.message);
  };

  push(error.message);
  if (error.info && typeof error.info === 'object') push(error.info.message);
  if (error.originalError) push(describeError(error.originalError));

  const details = error.details || (error.info && error.info.details);
  if (Array.isArray(details)) {
    for (const detail of details) {
      if (typeof detail === 'string') push(detail);
      else if (detail && typeof detail === 'object') push(detail.message);
    }
  }

  const unique = [...new Set(collected.filter(Boolean))];
  return unique.length > 0 ? unique.join(' | ') : 'Unknown database error.';
}

let poolPromise = null;
let activePool = null;

function clearPool(reason) {
  if (reason) console.error(`[DB] Resetting connection pool: ${reason}`);
  poolPromise = null;
  activePool = null;
}

async function destroyPool(pool) {
  if (!pool) return;
  try {
    await pool.close();
  } catch (closeError) {
    console.warn('[DB] Pool close error (ignored):', describeError(closeError));
  }
}

function createPool() {
  const connectionConfig = {
    connectionString: getConnectionString(),
    driver: 'msnodesqlv8',
    options: {
      trustedConnection: env.DB_AUTH !== 'sql',
      trustServerCertificate: env.DB_TRUST_SERVER_CERTIFICATE
    },
    pool: {
      max: env.DB_POOL_MAX,
      min: 0,
      idleTimeoutMillis: 30000
    },
    connectionTimeout: env.DB_CONNECTION_TIMEOUT_MS,
    requestTimeout: env.DB_REQUEST_TIMEOUT_MS
  };

  return sql.connect(connectionConfig);
}

/**
 * Opens a pool with bounded retries. SQL Server Express on a busy desktop can
 * briefly refuse new logins; a single retry with backoff avoids turning that
 * into a spurious hard failure, while the bounded attempt count prevents the
 * connection storms that exhaust server sessions.
 */
async function connectWithRetry(attempt = 1) {
  const maxAttempts = 3;
  try {
    return await createPool();
  } catch (error) {
    const message = describeError(error);
    if (error.code === 'DB_NOT_CONFIGURED' || attempt >= maxAttempts) {
      error.detailedMessage = message;
      throw error;
    }
    const backoffMs = 500 * attempt;
    console.warn(`[DB] Attempt ${attempt}/${maxAttempts} failed (${message}); retrying in ${backoffMs}ms`);
    await new Promise(resolve => setTimeout(resolve, backoffMs));
    return connectWithRetry(attempt + 1);
  }
}

function getPool() {
  if (!poolPromise) {
    poolPromise = connectWithRetry()
      .then(pool => {
        activePool = pool;
        // A rejected pool poisons every later request; drop it so the next
        // caller re-establishes a connection instead of reusing a dead handle.
        pool.on('error', poolError => clearPool(describeError(poolError)));
        console.log(`[DB] Connected to SQL Server (${env.dbTarget.server} / ${env.dbTarget.database}).`);
        return pool;
      })
      .catch(error => {
        clearPool();
        throw error;
      });
  }
  return poolPromise;
}

/**
 * Runs a real round-trip against SQL Server so callers can prove connectivity
 * rather than assuming it. Never throws: returns a structured, secret-free
 * result suitable for a health endpoint.
 */
async function verifyDatabaseConnection() {
  const startedAt = Date.now();
  const result = {
    reachable: false,
    ...env.dbTarget,
    latencyMs: null,
    serverVersion: null,
    error: null
  };

  try {
    if (!env.DB_SERVER || !env.DB_DATABASE) {
      result.error = 'DB_SERVER and/or DB_DATABASE are not configured.';
      return result;
    }

    const pool = await getPool();
    const probe = await pool.request().query(
      'SELECT DB_NAME() AS current_database, SERVERPROPERTY(\'ProductVersion\') AS product_version'
    );
    const row = probe.recordset[0] || {};
    result.reachable = true;
    result.actualDatabase = row.current_database || null;
    result.serverVersion = row.product_version ? String(row.product_version) : null;
    result.latencyMs = Date.now() - startedAt;
  } catch (error) {
    result.error = error.detailedMessage || describeError(error);
    result.latencyMs = Date.now() - startedAt;
  }

  return result;
}

/** Closes the pooled connection; used on shutdown and by the test suite. */
async function closePool() {
  const pool = activePool;
  clearPool();
  await destroyPool(pool);
}

module.exports = {
  sql,
  getPool,
  getConnectionString,
  describeError,
  verifyDatabaseConnection,
  closePool
};
