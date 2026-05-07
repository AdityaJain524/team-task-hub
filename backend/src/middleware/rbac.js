/**
 * backend/src/middleware/rbac.js
 *
 * Role-Based Access Control middleware.
 *
 * Global roles (stored on users.role):
 *   admin  — full access to everything
 *   member — read/write own resources; cannot manage other users
 *   viewer — read-only access; cannot create, update, or delete
 *
 * Per-team roles (stored on team_members.role):
 *   admin  — can manage the team and its tasks
 *   member — can create/update tasks within the team
 *   viewer — read-only within the team
 *
 * Exports:
 *   requireRole(...roles)          — global role gate
 *   requireTeamRole(...roles)      — per-team role gate (needs :teamId param)
 *   requireOwnerOrRole(field, ...roles) — owner check OR global role fallback
 */

'use strict';

const pool = require('../db');

// ─── Global role gate ─────────────────────────────────────────────────────────

/**
 * Allow only users whose global role is in the provided list.
 *
 * Usage:  router.delete('/:id', requireRole('admin'), handler)
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden — requires one of: ${roles.join(', ')}`,
      });
    }
    next();
  };
}

// ─── Per-team role gate ───────────────────────────────────────────────────────

/**
 * Allow only users whose role within the team (from team_members) is in the
 * provided list. Global admins always pass.
 *
 * Expects req.params.teamId to be set.
 *
 * Usage:  router.post('/:teamId/tasks', requireTeamRole('admin', 'member'), handler)
 */
function requireTeamRole(...roles) {
  return async (req, res, next) => {
    try {
      if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });

      // Global admins bypass per-team checks
      if (req.user.role === 'admin') return next();

      const teamId = req.params.teamId || req.params.id;
      if (!teamId) return res.status(400).json({ error: 'Missing teamId param' });

      const { rows } = await pool.query(
        'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
        [teamId, req.user.id]
      );

      if (rows.length === 0) {
        return res.status(403).json({ error: 'You are not a member of this team' });
      }

      const teamRole = rows[0].role;
      if (!roles.includes(teamRole)) {
        return res.status(403).json({
          error: `Forbidden — requires team role: ${roles.join(', ')}`,
        });
      }

      // Expose the resolved team role for downstream handlers
      req.teamRole = teamRole;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// ─── Owner-or-role gate ───────────────────────────────────────────────────────

/**
 * Allow the resource owner OR users with one of the specified global roles.
 *
 * @param {string} ownerField  Name of the field on req.resource that holds the
 *                             owner's user ID. The route handler must set
 *                             req.resource before this middleware runs, or pass
 *                             a loader function as the second argument.
 * @param {...string} roles    Global roles that bypass the ownership check.
 *
 * Usage:
 *   router.delete('/:id', loadTask, requireOwnerOrRole('created_by', 'admin'), handler)
 */
function requireOwnerOrRole(ownerField, ...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });

    // Global role bypass
    if (roles.includes(req.user.role)) return next();

    // Ownership check
    const resource = req.resource;
    if (!resource) {
      return res.status(500).json({ error: 'Server error: resource not loaded' });
    }

    if (resource[ownerField] !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden — you do not own this resource' });
    }

    next();
  };
}

// ─── Viewer block ─────────────────────────────────────────────────────────────

/**
 * Convenience middleware: block viewers from mutating resources.
 * Equivalent to requireRole('admin', 'member') but with a clearer error.
 */
function denyViewers(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: 'Viewers have read-only access' });
  }
  next();
}

module.exports = { requireRole, requireTeamRole, requireOwnerOrRole, denyViewers };
