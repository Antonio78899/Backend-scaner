// db.js
const { Pool } = require('pg');

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');

const PRIMARY_URL  = process.env.DATABASE_URL;        // ej: pooler 6543
const FALLBACK_URL = process.env.DATABASE_URL_DIRECT; // ej: directo 5432 (opcional)

function redact(url = '') {
  // oculta password en logs
  return url.replace(/(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@)/i, '$1******$2');
}

function makeConfig(connectionString) {
  return {
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,
    keepAlive: true,
    connectionTimeoutMillis: 10_000, // 10s para abrir nueva conexión
    idleTimeoutMillis: 30_000,       // 30s inactiva antes de liberar
    // Nota: no usar prepared statements nombrados con pooler 6543 (evita 'name' en queries)
  };
}

let pool = null;
let activeUrl = FALLBACK_URL || PRIMARY_URL;

// crea un pool nuevo con la URL activa
function createPool() {
  if (!activeUrl) throw new Error('DATABASE_URL no está definido');
  const cfg = makeConfig(activeUrl);
  const p = new Pool(cfg);

  p.on('error', (err) => {
    console.error('⚠️  Error inesperado en el pool:', {
      message: err?.message,
      code: err?.code,
      errno: err?.errno,
      address: err?.address,
      port: err?.port,
      stack: err?.stack,
    });
    // no cerramos aquí; dejamos que el heartbeat gestione la reconexión
  });

  return p;
}

// test corto
async function ping() {
  return pool.query('SELECT 1');
}

// backoff exponencial con jitter
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const backoff = (attempt, base = 1000, cap = 30_000) =>
  Math.min(cap, base * 2 ** Math.max(0, attempt - 1)) + Math.floor(Math.random() * 500);

async function initPoolWithRetry(label = 'inicial') {
  let attempt = 0;
  // intenta indefinido hasta lograr conexión
  for (;;) {
    try {
      if (pool) { try { await pool.end(); } catch {} }
      pool = createPool();
      await ping();
      console.log(`✅ Conectado a PostgreSQL (${label}) usando ${redact(activeUrl)}`);
      return;
    } catch (err) {
      attempt++;
      console.error(`❌ Falló conexión (${label}) intento ${attempt}:`, {
        message: err?.message,
        code: err?.code,
        errno: err?.errno,
        address: err?.address,
        port: err?.port,
      });

      // si estamos en pooler y falla repetido, probamos fallback 5432 (si está)
      const isPooler = /pooler\.supabase\.com:6543/i.test(activeUrl || '');
      if (isPooler && FALLBACK_URL && attempt >= 3) {
        console.warn('↪️  Cambiando a conexión directa (fallback 5432) por fallos con el pooler…');
        activeUrl = FALLBACK_URL;
        attempt = 0; // reinicia backoff para la nueva URL
      }

      await sleep(backoff(attempt));
    }
  }
}

// Heartbeat: cada 60s
setInterval(async () => {
  try {
    await ping();
    console.log(`✅ [${new Date().toLocaleString()}] DB OK`);
  } catch (err) {
    console.error(`❌ [${new Date().toLocaleString()}] DB caída:`, {
      message: err?.message,
      code: err?.code,
      errno: err?.errno,
      address: err?.address,
      port: err?.port,
    });
    // reintenta con backoff; cambia a fallback si procede
    await initPoolWithRetry('reconexión');
  }
}, 60_000);

// crea el pool por primera vez
(async () => {
  activeUrl = PRIMARY_URL;
  await initPoolWithRetry('arranque');
})();

module.exports = {
  get pool () { return pool; },   // para usar: const { pool } = require('./db')
};

