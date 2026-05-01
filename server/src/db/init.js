const fs = require('fs');
const path = require('path');
const pool = require('./pool');

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('✓ Database schema initialized');
    process.exit(0);
  } catch (err) {
    console.error('✗ Failed to initialize schema:', err);
    process.exit(1);
  }
})();
