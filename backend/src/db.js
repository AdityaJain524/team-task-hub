/**
 * backend/src/db.js
 *
 * PostgreSQL connection pool + schema initialisation.
 *
 * Usage as a module:  const pool = require('./db');
 * Usage as a script:  node src/db.js --init   (creates tables + seeds admin)
 */

'use strict';

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

// ─── Connection pool ──────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/team_task_hub',
  // Keep connections alive in serverless / Railway environments
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

// ─── Schema DDL ───────────────────────────────────────────────────────────────

const SCHEMA_SQL = `
-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enum types ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE app_role    AS ENUM ('admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE team_member_role AS ENUM ('admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  full_name     TEXT        NOT NULL,
  role          app_role    NOT NULL DEFAULT 'member',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Teams ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  description TEXT,
  created_by  UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Team members (with per-team role) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_members (
  id       UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id  UUID             NOT NULL REFERENCES teams(id)  ON DELETE CASCADE,
  user_id  UUID             NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  role     team_member_role NOT NULL DEFAULT 'member',
  added_at TIMESTAMPTZ      NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

-- ── Tasks ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID          REFERENCES teams(id) ON DELETE SET NULL,
  title       TEXT          NOT NULL,
  description TEXT,
  status      task_status   NOT NULL DEFAULT 'todo',
  priority    task_priority NOT NULL DEFAULT 'medium',
  deadline    TIMESTAMPTZ,
  assigned_to UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_by  UUID          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_team       ON tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee   ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
`;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run the schema DDL against the connected database.
 * Safe to call multiple times — uses IF NOT EXISTS / DO-EXCEPTION guards.
 */
async function initSchema() {
  await pool.query(SCHEMA_SQL);
  console.log('[db] Schema initialised');
}

/**
 * Seed a default admin user if none exists yet.
 */
async function seedAdmin() {
  const email    = process.env.SEED_ADMIN_EMAIL    || 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD || 'changeme123';
  const name     = process.env.SEED_ADMIN_NAME     || 'System Admin';

  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (rows.length > 0) {
    console.log(`[db] Admin already exists: ${email}`);
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'admin')`,
    [email, hash, name]
  );
  console.log(`[db] Default admin created: ${email}`);
}

module.exports = pool;

// ─── CLI entry-point ──────────────────────────────────────────────────────────
// node src/db.js --init
if (require.main === module && process.argv.includes('--init')) {
  (async () => {
    try {
      await initSchema();
      await seedAdmin();
      console.log('[db] Initialisation complete');
      process.exit(0);
    } catch (err) {
      console.error('[db] Initialisation failed:', err);
      process.exit(1);
    }
  })();
}

module.exports.initSchema = initSchema;
module.exports.seedAdmin  = seedAdmin;
