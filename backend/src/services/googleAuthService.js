const { OAuth2Client } = require('google-auth-library');
const env = require('../config/env');

let client = null;

function getClient() {
  if (!client && env.GOOGLE_CLIENT_ID) {
    client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }
  return client;
}

/**
 * Validates a Google Identity Token.
 * Enforces audience validation and verified email verification.
 */
async function verifyGoogleToken(idToken) {
  if (!env.GOOGLE_CLIENT_ID) {
    const error = new Error('Google OAuth is not configured on this server. Set GOOGLE_CLIENT_ID in the backend environment.');
    error.statusCode = 503;
    throw error;
  }

  const oauthClient = getClient();
  let ticket;
  try {
    ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID
    });
  } catch (err) {
    const authErr = new Error('Failed to verify Google identity: ' + (err.message || 'Invalid token'));
    authErr.statusCode = 401;
    throw authErr;
  }

  const payload = ticket.getPayload();
  if (!payload || !payload.email) {
    const invalidErr = new Error('Google token did not contain a valid email address.');
    invalidErr.statusCode = 400;
    throw invalidErr;
  }

  if (!payload.email_verified) {
    const unverifiedErr = new Error('Your Google email address is not verified by Google.');
    unverifiedErr.statusCode = 403;
    throw unverifiedErr;
  }

  return {
    email: payload.email.toLowerCase().trim(),
    name: payload.name || payload.email.split('@')[0],
    sub: payload.sub,
    picture: payload.picture
  };
}

module.exports = {
  verifyGoogleToken
};
