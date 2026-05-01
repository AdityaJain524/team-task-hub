const pool = require('../db/pool');

exports.create = async ({ projectId, title, description, deadline, assignedTo, priority, createdBy }) => {
  const { rows } = await pool.query(
    `INSERT INTO tasks (project_id, title, description, deadline, assigned_to, priority, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [projectId, title, description, deadline, assignedTo, priority || 'medium', createdBy]
  );
  return rows[0];
};

exports.findById = async (id) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [id]);
  return rows[0] || null;
};

exports.listForProject = async (projectId) => {
  const { rows } = await pool.query(
    `SELECT t.*, u.full_name AS assignee_name, u.email AS assignee_email
     FROM tasks t
     LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.project_id = $1
     ORDER BY t.created_at DESC`,
    [projectId]
  );
  return rows;
};

exports.listForUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT t.*, p.name AS project_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     WHERE t.assigned_to = $1
     ORDER BY t.created_at DESC`,
    [userId]
  );
  return rows;
};

exports.listAll = async () => {
  const { rows } = await pool.query(
    `SELECT t.*, p.name AS project_name, u.full_name AS assignee_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN users u ON u.id = t.assigned_to
     ORDER BY t.created_at DESC`
  );
  return rows;
};

exports.update = async (id, { title, description, deadline, assignedTo, status, priority }) => {
  const { rows } = await pool.query(
    `UPDATE tasks
     SET title = $1, description = $2, deadline = $3, assigned_to = $4,
         status = $5, priority = $6, updated_at = now()
     WHERE id = $7 RETURNING *`,
    [title, description, deadline, assignedTo, status, priority, id]
  );
  return rows[0] || null;
};

exports.updateStatus = async (id, status) => {
  const { rows } = await pool.query(
    `UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0] || null;
};

exports.remove = async (id) => {
  await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
};

exports.dashboardStats = async ({ userId, isAdmin }) => {
  const params = [];
  let where = '';
  if (!isAdmin) {
    params.push(userId);
    where = `WHERE t.assigned_to = $1
             OR t.project_id IN (SELECT project_id FROM project_members WHERE user_id = $1)`;
  }
  const { rows } = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'todo')::int         AS todo,
       COUNT(*) FILTER (WHERE status = 'in_progress')::int  AS in_progress,
       COUNT(*) FILTER (WHERE status = 'done')::int         AS done,
       COUNT(*) FILTER (WHERE deadline IS NOT NULL
                        AND deadline < now()
                        AND status <> 'done')::int          AS overdue
     FROM tasks t
     ${where}`,
    params
  );
  const stats = rows[0];

  if (isAdmin) {
    const { rows: userStats } = await pool.query(
      `SELECT u.full_name, COUNT(t.id)::int as count
       FROM users u
       LEFT JOIN tasks t ON t.assigned_to = u.id
       GROUP BY u.id, u.full_name
       ORDER BY count DESC`
    );
    stats.tasksPerUser = userStats;
  }

  return stats;
};
