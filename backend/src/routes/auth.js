/**
 * backend/src/routes/auth.js
 *
 * Authentication routes:
 *   POST /api/auth/signup   — register a new account (role: member)
 *   POST /api/auth/login    — login, receive JWT
 *   POST /api/auth/verify   — stateless token verification (no Authorization header needed)
 *   GET  /api/auth/me       — return current user (requires Bearer token)
 */

'use strict';

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const { z }   = require('zod');
const pool    = require('../db');
const { authenticate, signToken, verifyToken } = require('../middleware/auth');

// ─── Validation schemas ───────────────────────────────────────────────────────

const signupSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(80).trim(),
});

const loginSchema = z.object({
  email:    z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const verifySchema = z.object({
  token: z.string().min(10, 'Token is required'),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeUser(row) {
  return {
    id:         row.id,
    email:      row.email,
    full_name:  row.full_name,
    role:       row.role,
    created_at: row.created_at,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/signup
 * Body: { email, password, fullName }
 * Returns: { user, token }
 *
 * New accounts always start as 'member'. Admins are promoted separately.
 */
router.post('/signup', async (req, res, next) => {
  try {
    const result = signupSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error:   'Validation failed',
        details: result.error.flatten(),
      });
    }

    const { email, password, fullName } = result.data;

    // Duplicate email check
    const { rows: existing } = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, 'member')
       RETURNING id, email, full_name, role, created_at`,
      [email.toLowerCase(), passwordHash, fullName]
    );

    const user = rows[0];
    return res.status(201).json({ user: safeUser(user), token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/login
 * Body: { email, password }
 * Returns: { user, token }
 */
router.post('/login', async (req, res, next) => {
  try {
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error:   'Validation failed',
        details: result.error.flatten(),
      });
    }

    const { email, password } = result.data;

    const { rows } = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    const user = rows[0];

    // Constant-time comparison even when user doesn't exist
    const dummyHash = '$2a$12$invalidhashfortimingprotection000000000000000000000000';
    const passwordOk = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (!user || !passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    return res.json({ user: safeUser(user), token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/verify
 * Body: { token }
 * Returns: { valid: true, user, payload } | { valid: false, error }
 *
 * Stateless — no Authorization header required. Useful for the frontend to
 * validate a token stored in localStorage on page load.
 */
router.post('/verify', async (req, res, next) => {
  try {
    const result = verifySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ valid: false, error: 'Token is required' });
    }

    const { token } = result.data;

    let payload;
    try {
      payload = verifyToken(token);
    } catch (err) {
      const reason =
        err.name === 'TokenExpiredError' ? 'Token expired' :
        err.name === 'JsonWebTokenError' ? 'Invalid token' :
        'Token verification failed';
      return res.status(401).json({ valid: false, error: reason });
    }

    const { rows } = await pool.query(
      'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1',
      [payload.sub]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ valid: false, error: 'User no longer exists' });
    }
    if (payload.role && payload.role !== user.role) {
      return res.status(401).json({ valid: false, error: 'Role mismatch — please re-login' });
    }

    return res.json({ valid: true, user: safeUser(user), payload });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Requires: Authorization: Bearer <token>
 * Returns: { user }
 */
router.get('/me', authenticate, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

module.exports = router;
