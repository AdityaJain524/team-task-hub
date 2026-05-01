const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./pool');

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('✓ Database schema initialized');

    // Seed default admin
    const adminEmail = 'adminmanager@gmail.com';
    const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    
    if (rows.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO users (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
        [adminEmail, hash, 'System Admin', 'admin']
      );
      console.log(`✓ Default admin created: ${adminEmail}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('✗ Failed to initialize database:', err);
    process.exit(1);
  }
})();
