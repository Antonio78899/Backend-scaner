const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false   // 👈 Acepta certificados self-signed
  },
  max: 5,
  idleTimeoutMillis: 0,
});

module.exports = pool;
