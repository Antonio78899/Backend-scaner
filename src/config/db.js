// db.js
const { Pool } = require('pg');

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');

let pool;

function createPool() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false }, // TLS ON en nube
    max: 5,
  });

  // Escucha errores del pool
  pool.on('error', (err) => {
    console.error('⚠️ Error inesperado en el pool:', err.message);
    reconnect();
  });

  return pool;
}

async function reconnect(retries = 5, delayMs = 5000) {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`🔄 Intentando reconectar... intento ${i}`);
      pool = createPool();
      await pool.query('SELECT 1');
      console.log('✅ Reconexion exitosa');
      return;
    } catch (err) {
      console.error(`❌ Falló la reconexión (${i}/${retries}):`, err.message);
      if (i < retries) {
        await new Promise((res) => setTimeout(res, delayMs));
      }
    }
  }
  console.error('⛔ No se pudo reconectar a PostgreSQL después de varios intentos.');
}

// Crear pool inicial
pool = createPool();

// Heartbeat cada minuto
setInterval(async () => {
  try {
    await pool.query('SELECT 1');
    console.log(`✅ [${new Date().toLocaleString()}] Conexión activa`);
  } catch (err) {
    console.error(`❌ [${new Date().toLocaleString()}] Conexión caída:`, err.message);
    await reconnect();
  }
}, 60 * 1000);

module.exports = pool;

