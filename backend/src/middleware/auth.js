/**
 * backend/src/middleware/auth.js
 *
 * JWT authentication middleware.
 *
 * Exports:
 *   authenticate   — Express middleware; attaches req.user from DB
 *   signToken(user) — creates a signed JWT
 *   verifyToken(token) — verifies and decodes a JWT (throws on failure)
 */

'use strict';

const jwt  = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET     = process.env.JWT_SECRET     || 'dev-only-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_ISSUER     = 'team-task-hub';
const JWT_AUDIENCE   = 'team-task-hub-client';

// ─── Token helpers ────────────────────────────────────────────────────────────

/**
 * Sign a JWT for the given user object.
 * Payload includes sub (id), email, and role so the frontend can read them
 * without an extra round-trip.
 */
function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN, issuer: JWT_ISSUER, audience: JWT_AUDIENCE }
  );
}

/**
 * Verify a raw JWT string.
 * Returns the decoded payload or throws a JsonWebTokenError / TokenExpiredError.
 */
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer:   JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

// ─── Express middleware ───────────────────────────────────────────────────────

/**
 * Require a valid Bearer JWT.
 * On success: attaches req.user (DB row) and req.tokenPayload.
 * On failure: responds 401.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Bearer token' });
    }

    const token = header.slice(7).trim();
    if (!token) return res.status(401).json({ error: 'Empty token' });

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      const reason =
        err.name === 'TokenExpiredError' ? 'Token expired' :
        err.name === 'JsonWebTokenError' ? 'Invalid token' :
        'Token verification failed';
      return res.status(401).json({ error: reason });
    }

    // Load fresh user from DB — catches deleted accounts and role changes
    const { rows } = await pool.query(
      'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'User no longer exists' });

    // Defense-in-depth: role in token must still match DB
    if (payload.role && payload.role !== user.role) {
      return res.status(401).json({ error: 'Role mismatch — please re-login' });
    }

    req.user         = user;
    req.tokenPayload = payload;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { authenticate, signToken, verifyToken };
