const { Pool } = require('pg');
const cfg = require('../config');

const pool = new Pool({ connectionString: cfg.DATABASE_URL });

module.exports = pool;
