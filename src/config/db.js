// src/config/db.js
const { Pool } = require('pg');

let raw = (process.env.DATABASE_URL || '').trim();
// Por si accidentalmente pusiste "DATABASE_URL=postgresql://..."
if (raw.startsWith('DATABASE_URL=')) raw = raw.slice('DATABASE_URL='.length);

if (!raw) {
  console.error('❌ DATABASE_URL no está definida');
  process.exit(1);
}

console.log('🔎 DATABASE_URL:', raw.replace(/:[^:@/]+@/, ':****@'));

const pool = new Pool({
  connectionString: raw,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log('✅ DB OK (SELECT 1)');
  } catch (e) {
    console.error('❌ DB FAIL', e);
  }
})();

module.exports = pool;
