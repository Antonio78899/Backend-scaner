const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // pon aquí la URL del Transaction pooler
  ssl: { rejectUnauthorized: false },
  max: 5,                 // pequeño para free tier
  idleTimeoutMillis: 0,   // no cierres por inactividad
});

module.exports = pool;
