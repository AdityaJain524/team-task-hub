const pool = require('../db/pool');

exports.findByEmail = async (email) => {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] || null;
};

exports.findById = async (id) => {
  const { rows } = await pool.query(
    'SELECT id, email, full_name, role, created_at FROM users WHERE id = $1',
    [id]
  );
  return rows[0] || null;
};

exports.create = async ({ email, passwordHash, fullName, role }) => {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, full_name, role, created_at`,
    [email, passwordHash, fullName, role]
  );
  return rows[0];
};

exports.countAll = async () => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM users');
  return rows[0].c;
};

exports.listAll = async () => {
  const { rows } = await pool.query(
    'SELECT id, email, full_name, role, created_at FROM users ORDER BY created_at DESC'
  );
  return rows;
};
