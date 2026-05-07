/**
 * backend/src/routes/teams.js
 *
 * Team management with RBAC.
 *
 * Permissions:
 *   - admin (global)  : full access — create, read, update, delete any team
 *   - member          : create teams (becomes team admin); update/delete only
 *                       teams they administer; read teams they belong to
 *   - viewer          : read-only — list and get teams they belong to
 *
 * Routes:
 *   GET    /api/teams              — list teams (admin: all; others: own)
 *   POST   /api/teams              — create team (admin, member)
 *   GET    /api/teams/:id          — get team details
 *   PUT    /api/teams/:id          — update team (global admin or team admin)
 *   DELETE /api/teams/:id          — delete team (global admin or team admin)
 */

'use strict';

const router = require('express').Router();
const { z }  = require('zod');
const pool   = require('../db');
const { authenticate }                 = require('../middleware/auth');
const { requireRole, denyViewers }     = require('../middleware/rbac');

router.use(authenticate);

// ─── Validation schemas ───────────────────────────────────────────────────────

const teamSchema = z.object({
  name:        z.string().min(1, 'Name is required').max(120).trim(),
  description: z.string().max(2000).trim().optional().nullable(),
});

// ─── Middleware: load team into req.resource ──────────────────────────────────

async function loadTeam(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT * FROM teams WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Team not found' });
    req.resource = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Resolve the current user's role within the loaded team.
 * Attaches req.teamRole (or null if not a member).
 * Global admins get 'admin' without a DB lookup.
 */
async function resolveTeamRole(req, res, next) {
  try {
    if (req.user.role === 'admin') {
      req.teamRole = 'admin';
      return next();
    }
    const { rows } = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [req.resource.id, req.user.id]
    );
    req.teamRole = rows[0]?.role ?? null;
    next();
  } catch (err) {
    next(err);
  }
}

/** Require the user to be a member of the loaded team (any role). */
function requireTeamMembership(req, res, next) {
  if (req.user.role === 'admin') return next(); // global admin always passes
  if (!req.teamRole) {
    return res.status(403).json({ error: 'Forbidden — you are not a member of this team' });
  }
  next();
}

/** Require the user to be a team-level admin (or global admin). */
function requireTeamAdmin(req, res, next) {
  if (req.teamRole === 'admin') return next();
  return res.status(403).json({ error: 'Forbidden — requires team admin role' });
}

// ─── GET /api/teams ───────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    let rows;

    if (req.user.role === 'admin') {
      // Global admins see all teams with member counts
      ({ rows } = await pool.query(
        `SELECT t.*,
                COUNT(tm.id)::int AS member_count
         FROM teams t
         LEFT JOIN team_members tm ON tm.team_id = t.id
         GROUP BY t.id
         ORDER BY t.created_at DESC`
      ));
    } else {
      // Others see only teams they belong to
      ({ rows } = await pool.query(
        `SELECT t.*,
                COUNT(tm2.id)::int AS member_count,
                tm.role            AS my_role
         FROM teams t
         JOIN team_members tm  ON tm.team_id  = t.id AND tm.user_id = $1
         LEFT JOIN team_members tm2 ON tm2.team_id = t.id
         GROUP BY t.id, tm.role
         ORDER BY t.created_at DESC`,
        [req.user.id]
      ));
    }

    res.json({ teams: rows });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/teams ──────────────────────────────────────────────────────────

router.post('/', denyViewers, async (req, res, next) => {
  try {
    const result = teamSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }

    const { name, description } = result.data;

    // Create the team
    const { rows: teamRows } = await pool.query(
      `INSERT INTO teams (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description ?? null, req.user.id]
    );
    const team = teamRows[0];

    // Creator automatically becomes a team admin
    await pool.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, 'admin')
       ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'admin'`,
      [team.id, req.user.id]
    );

    res.status(201).json({ team });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/teams/:id ───────────────────────────────────────────────────────

router.get('/:id', loadTeam, resolveTeamRole, requireTeamMembership, async (req, res, next) => {
  try {
    // Enrich with member count
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS member_count FROM team_members WHERE team_id = $1`,
      [req.resource.id]
    );

    res.json({
      team: {
        ...req.resource,
        member_count: rows[0].member_count,
        my_role:      req.teamRole,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/teams/:id ───────────────────────────────────────────────────────

router.put('/:id', loadTeam, resolveTeamRole, requireTeamMembership, requireTeamAdmin, async (req, res, next) => {
  try {
    const result = teamSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }

    const { name, description } = result.data;

    const { rows } = await pool.query(
      `UPDATE teams
       SET name = $1, description = $2, updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [name, description ?? null, req.params.id]
    );

    res.json({ team: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/teams/:id ────────────────────────────────────────────────────

router.delete('/:id', loadTeam, resolveTeamRole, requireTeamMembership, requireTeamAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM teams WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
