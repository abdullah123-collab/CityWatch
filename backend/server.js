const app = require('./src/server');
const env = require('./src/config/env');
const { getPool, closePool, describeError } = require('./src/config/db');

async function start() {
  try {
    env.assertDatabaseConfigured();
  } catch (configError) {
    console.error(`[DB] ${configError.message}`);
    process.exitCode = 1;
    return;
  }

  // Prove the database is reachable before claiming the API is usable. The
  // server still listens when this fails so /api/health can report the real
  // reason instead of the process dying with an opaque stack trace.
  let databaseReady = false;
  try {
    await getPool();
    databaseReady = true;
  } catch (dbError) {
    console.error(`[DB] NOT connected: ${describeError(dbError)}`);
    console.error('[DB] The API will start anyway; /api/health will report the database as unreachable.');
  }

  const server = app.listen(env.PORT, () => {
    console.log(`[CityWatch API] Listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    console.log(`[CityWatch API] Database at startup: ${databaseReady ? 'CONNECTED' : 'DISCONNECTED'}`);
  });

  server.on('error', listenError => {
    if (listenError.code === 'EADDRINUSE') {
      console.error(
        `[CityWatch API] Port ${env.PORT} is already in use. A backend instance is probably ` +
        'already running - stop it first, or set PORT in backend/.env to another value.'
      );
    } else {
      console.error('[CityWatch API] Failed to start:', describeError(listenError));
    }
    process.exitCode = 1;
  });

  const shutdown = async (signal) => {
    console.log(`[CityWatch API] ${signal} received, shutting down.`);
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
    // Never hang forever on lingering keep-alive sockets.
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();
