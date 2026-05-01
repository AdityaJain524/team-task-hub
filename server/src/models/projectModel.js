const pool = require('../db/pool');

exports.create = async ({ name, description, createdBy }) => {
  const { rows } = await pool.query(
    `INSERT INTO projects (name, description, created_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [name, description, createdBy]
  );
  return rows[0];
};

exports.findById = async (id) => {
  const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
  return rows[0] || null;
};

exports.listForAdmin = async () => {
  const { rows } = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
  return rows;
};

exports.listForMember = async (userId) => {
  const { rows } = await pool.query(
    `SELECT p.* FROM projects p
     JOIN project_members pm ON pm.project_id = p.id
     WHERE pm.user_id = $1
     ORDER BY p.created_at DESC`,
    [userId]
  );
  return rows;
};

exports.update = async (id, { name, description }) => {
  const { rows } = await pool.query(
    `UPDATE projects SET name = $1, description = $2 WHERE id = $3 RETURNING *`,
    [name, description, id]
  );
  return rows[0] || null;
};

exports.remove = async (id) => {
  await pool.query('DELETE FROM projects WHERE id = $1', [id]);
};

exports.isMember = async (projectId, userId) => {
  const { rows } = await pool.query(
    'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );
  return rows.length > 0;
};

exports.addMember = async (projectId, userId) => {
  await pool.query(
    `INSERT INTO project_members (project_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (project_id, user_id) DO NOTHING`,
    [projectId, userId]
  );
};

exports.removeMember = async (projectId, userId) => {
  await pool.query(
    'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );
};

exports.listMembers = async (projectId) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, pm.added_at
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY pm.added_at ASC`,
    [projectId]
  );
  return rows;
};
