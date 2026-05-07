/**
 * backend/src/routes/members.js
 *
 * Team member management — add, list, update role, and remove members.
 *
 * All routes are nested under /api/teams/:teamId/members.
 *
 * Permissions:
 *   - global admin    : full access
 *   - team admin      : add/remove members, change roles within the team
 *   - team member     : read-only (list members)
 *   - team viewer     : read-only (list members)
 *
 * Routes:
 *   GET    /api/teams/:teamId/members              — list members with roles
 *   POST   /api/teams/:teamId/members              — add a user to the team
 *   PATCH  /api/teams/:teamId/members/:userId/role — change a member's role
 *   DELETE /api/teams/:teamId/members/:userId      — remove a member
 */

'use strict';

const router = require('express').Router({ mergeParams: true });
const { z }  = require('zod');
const pool   = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ─── Validation schemas ───────────────────────────────────────────────────────

const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  role:   z.enum(['admin', 'member', 'viewer']).optional().default('member'),
});

const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer'], {
    errorMap: () => ({ message: "role must be 'admin', 'member', or 'viewer'" }),
  }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verify the team exists; return 404 if not. */
async function ensureTeamExists(teamId, res) {
  const { rows } = await pool.query('SELECT id FROM teams WHERE id = $1', [teamId]);
  if (!rows[0]) {
    res.status(404).json({ error: 'Team not found' });
    return false;
  }
  return true;
}

/**
 * Resolve the current user's effective role for the team.
 * Global admins always get 'admin'.
 */
async function getEffectiveTeamRole(userId, globalRole, teamId) {
  if (globalRole === 'admin') return 'admin';
  const { rows } = await pool.query(
    'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );
  return rows[0]?.role ?? null;
}

// ─── GET /api/teams/:teamId/members ──────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    if (!(await ensureTeamExists(teamId, res))) return;

    // Must be a member (any role) or global admin to list members
    const effectiveRole = await getEffectiveTeamRole(req.user.id, req.user.role, teamId);
    if (!effectiveRole) {
      return res.status(403).json({ error: 'Forbidden — you are not a member of this team' });
    }

    const { rows } = await pool.query(
      `SELECT
         u.id,
         u.email,
         u.full_name,
         u.role        AS global_role,
         tm.role       AS team_role,
         tm.added_at
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY tm.added_at ASC`,
      [teamId]
    );

    res.json({ members: rows });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/teams/:teamId/members ─────────────────────────────────────────

router.post('/', async (req, res, next) => {
  try {
    const { teamId } = req.params;
    if (!(await ensureTeamExists(teamId, res))) return;

    // Only team admins (or global admins) can add members
    const effectiveRole = await getEffectiveTeamRole(req.user.id, req.user.role, teamId);
    if (effectiveRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden — requires team admin role' });
    }

    const result = addMemberSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }

    const { userId, role } = result.data;

    // Verify the target user exists
    const { rows: userRows } = await pool.query(
      'SELECT id, email, full_name, role AS global_role FROM users WHERE id = $1',
      [userId]
    );
    if (!userRows[0]) return res.status(404).json({ error: 'User not found' });

    // Upsert — if already a member, update their role
    const { rows } = await pool.query(
      `INSERT INTO team_members (team_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [teamId, userId, role]
    );

    res.status(201).json({
      member: {
        ...userRows[0],
        team_role: rows[0].role,
        added_at:  rows[0].added_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/teams/:teamId/members/:userId/role ────────────────────────────

router.patch('/:userId/role', async (req, res, next) => {
  try {
    const { teamId, userId } = req.params;
    if (!(await ensureTeamExists(teamId, res))) return;

    // Only team admins (or global admins) can change roles
    const effectiveRole = await getEffectiveTeamRole(req.user.id, req.user.role, teamId);
    if (effectiveRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden — requires team admin role' });
    }

    const result = updateRoleSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }

    // Verify the target user is actually a member
    const { rows: memberRows } = await pool.query(
      'SELECT * FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    if (!memberRows[0]) {
      return res.status(404).json({ error: 'Member not found in this team' });
    }

    // Prevent a team admin from demoting themselves if they are the last admin
    if (userId === req.user.id && result.data.role !== 'admin') {
      const { rows: adminCount } = await pool.query(
        `SELECT COUNT(*)::int AS c FROM team_members WHERE team_id = $1 AND role = 'admin'`,
        [teamId]
      );
      if (adminCount[0].c <= 1) {
        return res.status(409).json({ error: 'Cannot demote the last team admin' });
      }
    }

    const { rows } = await pool.query(
      `UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3 RETURNING *`,
      [result.data.role, teamId, userId]
    );

    // Return enriched member object
    const { rows: userRows } = await pool.query(
      'SELECT id, email, full_name, role AS global_role FROM users WHERE id = $1',
      [userId]
    );

    res.json({
      member: {
        ...userRows[0],
        team_role: rows[0].role,
        added_at:  rows[0].added_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/teams/:teamId/members/:userId ────────────────────────────────

router.delete('/:userId', async (req, res, next) => {
  try {
    const { teamId, userId } = req.params;
    if (!(await ensureTeamExists(teamId, res))) return;

    // Only team admins (or global admins) can remove members
    const effectiveRole = await getEffectiveTeamRole(req.user.id, req.user.role, teamId);
    if (effectiveRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden — requires team admin role' });
    }

    // Verify the target user is a member
    const { rows: memberRows } = await pool.query(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );
    if (!memberRows[0]) {
      return res.status(404).json({ error: 'Member not found in this team' });
    }

    // Prevent removing the last admin
    if (memberRows[0].role === 'admin') {
      const { rows: adminCount } = await pool.query(
        `SELECT COUNT(*)::int AS c FROM team_members WHERE team_id = $1 AND role = 'admin'`,
        [teamId]
      );
      if (adminCount[0].c <= 1) {
        return res.status(409).json({ error: 'Cannot remove the last team admin' });
      }
    }

    await pool.query(
      'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, userId]
    );

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
