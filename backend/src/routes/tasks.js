/**
 * backend/src/routes/tasks.js
 *
 * Task CRUD with ownership validation and RBAC.
 *
 * All routes require authentication.
 *
 * Permissions:
 *   - admin (global)  : full access — create, read, update, delete any task
 *   - member          : create tasks; update/delete only tasks they created or
 *                       are assigned to; read tasks in their teams
 *   - viewer          : read-only — list and get; no create/update/delete
 *
 * Routes:
 *   GET    /api/tasks/dashboard          — aggregated stats for current user
 *   GET    /api/tasks/mine               — tasks assigned to current user
 *   GET    /api/tasks                    — list all tasks (admin) or own (member/viewer)
 *   GET    /api/tasks/team/:teamId       — tasks for a specific team
 *   GET    /api/tasks/:id                — single task
 *   POST   /api/tasks                    — create task (admin, member)
 *   PUT    /api/tasks/:id                — full update (admin, or owner)
 *   PATCH  /api/tasks/:id/status         — status-only update (admin, assignee, or creator)
 *   DELETE /api/tasks/:id                — delete (admin, or creator)
 */

'use strict';

const router = require('express').Router();
const { z }  = require('zod');
const pool   = require('../db');
const { authenticate }                          = require('../middleware/auth');
const { requireRole, requireOwnerOrRole, denyViewers } = require('../middleware/rbac');

router.use(authenticate);

// ─── Validation schemas ───────────────────────────────────────────────────────

const createSchema = z.object({
  title:       z.string().min(1, 'Title is required').max(200).trim(),
  description: z.string().max(4000).trim().optional().nullable(),
  teamId:      z.string().uuid('Invalid team ID').optional().nullable(),
  deadline:    z.string().datetime({ message: 'Invalid ISO 8601 datetime' }).optional().nullable(),
  assignedTo:  z.string().uuid('Invalid user ID').optional().nullable(),
  priority:    z.enum(['low', 'medium', 'high']).optional().default('medium'),
});

const updateSchema = z.object({
  title:       z.string().min(1).max(200).trim(),
  description: z.string().max(4000).trim().optional().nullable(),
  teamId:      z.string().uuid().optional().nullable(),
  deadline:    z.string().datetime().optional().nullable(),
  assignedTo:  z.string().uuid().optional().nullable(),
  status:      z.enum(['todo', 'in_progress', 'done']),
  priority:    z.enum(['low', 'medium', 'high']),
});

const patchStatusSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done'], {
    errorMap: () => ({ message: "status must be 'todo', 'in_progress', or 'done'" }),
  }),
});

// ─── Middleware: load task into req.resource ──────────────────────────────────

async function loadTask(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Task not found' });
    req.resource = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Check whether the current user can see tasks in a given team. */
async function canAccessTeam(userId, teamId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2',
    [teamId, userId]
  );
  return rows.length > 0;
}

// ─── GET /api/tasks/dashboard ─────────────────────────────────────────────────

router.get('/dashboard', async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const params  = [];
    let where     = '';

    if (!isAdmin) {
      params.push(req.user.id);
      where = `WHERE t.assigned_to = $1 OR t.created_by = $1
               OR t.team_id IN (
                 SELECT team_id FROM team_members WHERE user_id = $1
               )`;
    }

    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int                                                    AS total,
         COUNT(*) FILTER (WHERE status = 'todo')::int                    AS todo,
         COUNT(*) FILTER (WHERE status = 'in_progress')::int             AS in_progress,
         COUNT(*) FILTER (WHERE status = 'done')::int                    AS done,
         COUNT(*) FILTER (
           WHERE deadline IS NOT NULL
             AND deadline < now()
             AND status <> 'done'
         )::int                                                           AS overdue
       FROM tasks t
       ${where}`,
      params
    );

    const stats = rows[0];

    if (isAdmin) {
      const { rows: perUser } = await pool.query(
        `SELECT u.full_name, COUNT(t.id)::int AS count
         FROM users u
         LEFT JOIN tasks t ON t.assigned_to = u.id
         GROUP BY u.id, u.full_name
         ORDER BY count DESC`
      );
      stats.tasks_per_user = perUser;
    }

    res.json({ stats });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/tasks/mine ──────────────────────────────────────────────────────

router.get('/mine', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT t.*,
              tm.name  AS team_name,
              u.full_name AS assignee_name,
              u.email     AS assignee_email
       FROM tasks t
       LEFT JOIN teams tm ON tm.id = t.team_id
       LEFT JOIN users u  ON u.id  = t.assigned_to
       WHERE t.assigned_to = $1
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json({ tasks: rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/tasks ───────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const params  = [];
    let where     = '';

    if (!isAdmin) {
      params.push(req.user.id);
      where = `WHERE t.assigned_to = $1 OR t.created_by = $1
               OR t.team_id IN (
                 SELECT team_id FROM team_members WHERE user_id = $1
               )`;
    }

    const { rows } = await pool.query(
      `SELECT t.*,
              tm.name     AS team_name,
              u.full_name AS assignee_name,
              u.email     AS assignee_email
       FROM tasks t
       LEFT JOIN teams tm ON tm.id = t.team_id
       LEFT JOIN users u  ON u.id  = t.assigned_to
       ${where}
       ORDER BY t.created_at DESC`,
      params
    );

    res.json({ tasks: rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/tasks/team/:teamId ──────────────────────────────────────────────

router.get('/team/:teamId', async (req, res, next) => {
  try {
    const { teamId } = req.params;

    // Verify team exists
    const { rows: teamRows } = await pool.query('SELECT id FROM teams WHERE id = $1', [teamId]);
    if (!teamRows[0]) return res.status(404).json({ error: 'Team not found' });

    // Non-admins must be a team member
    if (req.user.role !== 'admin') {
      const access = await canAccessTeam(req.user.id, teamId);
      if (!access) return res.status(403).json({ error: 'Forbidden — not a team member' });
    }

    const { rows } = await pool.query(
      `SELECT t.*,
              u.full_name AS assignee_name,
              u.email     AS assignee_email
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.team_id = $1
       ORDER BY t.created_at DESC`,
      [teamId]
    );

    res.json({ tasks: rows });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────────

router.get('/:id', loadTask, async (req, res, next) => {
  try {
    const task = req.resource;

    // Non-admins can only see tasks they own, are assigned to, or belong to their team
    if (req.user.role !== 'admin') {
      const isOwner    = task.created_by === req.user.id;
      const isAssignee = task.assigned_to === req.user.id;
      const inTeam     = task.team_id ? await canAccessTeam(req.user.id, task.team_id) : false;

      if (!isOwner && !isAssignee && !inTeam) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }

    res.json({ task });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/tasks ──────────────────────────────────────────────────────────

router.post('/', denyViewers, async (req, res, next) => {
  try {
    const result = createSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }

    const { title, description, teamId, deadline, assignedTo, priority } = result.data;

    // If a teamId is provided, verify the team exists and the user has access
    if (teamId) {
      const { rows: teamRows } = await pool.query('SELECT id FROM teams WHERE id = $1', [teamId]);
      if (!teamRows[0]) return res.status(404).json({ error: 'Team not found' });

      if (req.user.role !== 'admin') {
        const { rows: memberRows } = await pool.query(
          `SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
          [teamId, req.user.id]
        );
        if (!memberRows[0]) {
          return res.status(403).json({ error: 'Forbidden — not a member of this team' });
        }
        // Viewers within the team cannot create tasks
        if (memberRows[0].role === 'viewer') {
          return res.status(403).json({ error: 'Team viewers cannot create tasks' });
        }
      }
    }

    // Validate assignedTo user exists
    if (assignedTo) {
      const { rows: userRows } = await pool.query('SELECT id FROM users WHERE id = $1', [assignedTo]);
      if (!userRows[0]) return res.status(404).json({ error: 'Assigned user not found' });
    }

    const { rows } = await pool.query(
      `INSERT INTO tasks (title, description, team_id, deadline, assigned_to, priority, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, description ?? null, teamId ?? null, deadline ?? null, assignedTo ?? null, priority, req.user.id]
    );

    res.status(201).json({ task: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/tasks/:id ───────────────────────────────────────────────────────

router.put('/:id', loadTask, denyViewers, requireOwnerOrRole('created_by', 'admin'), async (req, res, next) => {
  try {
    const result = updateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }

    const { title, description, teamId, deadline, assignedTo, status, priority } = result.data;

    // Validate assignedTo user exists
    if (assignedTo) {
      const { rows: userRows } = await pool.query('SELECT id FROM users WHERE id = $1', [assignedTo]);
      if (!userRows[0]) return res.status(404).json({ error: 'Assigned user not found' });
    }

    const { rows } = await pool.query(
      `UPDATE tasks
       SET title = $1, description = $2, team_id = $3, deadline = $4,
           assigned_to = $5, status = $6, priority = $7, updated_at = now()
       WHERE id = $8
       RETURNING *`,
      [title, description ?? null, teamId ?? null, deadline ?? null, assignedTo ?? null, status, priority, req.params.id]
    );

    res.json({ task: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/tasks/:id/status ─────────────────────────────────────────────

router.patch('/:id/status', loadTask, async (req, res, next) => {
  try {
    const result = patchStatusSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
    }

    const task = req.resource;

    // Viewers can never update status
    if (req.user.role === 'viewer') {
      return res.status(403).json({ error: 'Viewers have read-only access' });
    }

    // Non-admins: only the creator or assignee may update status
    if (req.user.role !== 'admin') {
      const isOwner    = task.created_by  === req.user.id;
      const isAssignee = task.assigned_to === req.user.id;
      if (!isOwner && !isAssignee) {
        return res.status(403).json({ error: 'Only the task creator, assignee, or an admin can update status' });
      }
    }

    const { rows } = await pool.query(
      `UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [result.data.status, req.params.id]
    );

    res.json({ task: rows[0] });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────

router.delete('/:id', loadTask, denyViewers, requireOwnerOrRole('created_by', 'admin'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
