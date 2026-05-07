/**
 * backend/src/index.js
 *
 * Main Express server entry-point.
 *
 * Starts the HTTP server, registers middleware, mounts route modules,
 * and optionally initialises the database schema on first boot.
 */

'use strict';

require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const rateLimit   = require('express-rate-limit');
const db             = require('./db');
const pool           = db;
const { initSchema } = db;

const authRoutes    = require('./routes/auth');
const tasksRoutes   = require('./routes/tasks');
const teamsRoutes   = require('./routes/teams');
const membersRoutes = require('./routes/members');

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT        = parseInt(process.env.PORT || '4000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// ─── App ──────────────────────────────────────────────────────────────────────

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
const allowedOrigins = CORS_ORIGIN === '*'
  ? '*'
  : CORS_ORIGIN.split(',').map((o) => o.trim());

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Tighter limit on auth endpoints to slow brute-force attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again later' },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please try again later' },
});

app.use('/api/auth', authLimiter);
app.use('/api',      generalLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ ok: false, db: 'disconnected', timestamp: new Date().toISOString() });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth',                    authRoutes);
app.use('/api/tasks',                   tasksRoutes);
app.use('/api/teams',                   teamsRoutes);
// Members are nested under teams: /api/teams/:teamId/members
app.use('/api/teams/:teamId/members',   membersRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[error]', err);

  // Postgres unique-violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry — resource already exists' });
  }
  // Postgres foreign-key violation
  if (err.code === '23503') {
    return res.status(409).json({ error: 'Referenced resource does not exist' });
  }
  // Postgres invalid UUID
  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Invalid ID format' });
  }

  const status  = err.status || err.statusCode || 500;
  const message = err.expose ? err.message : (status < 500 ? err.message : 'Internal server error');
  res.status(status).json({ error: message });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function start() {
  try {
    // Verify DB connectivity
    await pool.query('SELECT 1');
    console.log('[db] Connected');

    // Auto-initialise schema on first boot (idempotent)
    if (process.env.AUTO_MIGRATE !== 'false') {
      await initSchema();
    }

    app.listen(PORT, () => {
      console.log(`[server] Listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

start();
