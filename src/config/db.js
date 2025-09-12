// db.js
const { Pool } = require('pg');
const net = require('net');
const { URL } = require('url');

const raw = (process.env.DATABASE_URL || '').trim();
if (!raw) {
  console.error('❌ DATABASE_URL no está definida');
  process.exit(1);
}

let url;
try { url = new URL(raw); } catch (e) {
  console.error('❌ DATABASE_URL inválida:', raw);
  process.exit(1);
}

const host = url.hostname;
const port = Number(url.port || 5432);
const isLocal = /localhost|127\.0\.0\.1/.test(host);

// Pequeña prueba TCP para ver si el puerto está abierto
function testSocket(h, p, label) {
  return new Promise((resolve) => {
    const s = net.connect({ host: h, port: p }, () => {
      console.log(`✅ TCP OK ${label} ${h}:${p}`);
      s.end(); resolve(true);
    });
    s.on('error', (e) => {
      console.error(`❌ TCP FAIL ${label} ${h}:${p} →`, e.code || e.message);
      resolve(false);
    });
  });
}

async function buildPool() {
  console.log('🔎 DATABASE_URL:', raw.replace(/:[^:@/]+@/, ':****@'));
  console.log('🔎 Host/Port detectados:', host, port);

  // 1) Probar el socket del URL actual (normalmente 6543 pooler)
  const okPooler = await testSocket(host, port, 'POOLER/URL');

  // 2) Si falla y parece ser el pooler, probamos 5432 directo al cluster
  let useUrl = raw;
  if (!okPooler && host.includes('.pooler.supabase.com')) {
    const directHost = host.replace('.pooler.supabase.com', '.aws.supabase.co');
    const directUrl =
      raw
        .replace(host, directHost)
        .replace(`:${port}`, ':5432')
        .replace(/(\?|$)/, '?sslmode=require$1');

    console.warn('↪️  Fallback a conexión directa 5432:', directUrl.replace(/:[^:@/]+@/, ':****@'));
    const okDirect = await testSocket(directHost, 5432, 'DIRECT/5432');
    if (okDirect) useUrl = directUrl;
  }

  const pool = new Pool({
    connectionString: useUrl,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 5,
  });

  // Smoke test de SQL
  await pool.query('SELECT 1');
  console.log('✅ DB OK (SELECT 1)');

  return pool;
}

let poolPromise = buildPool();
module.exports = {
  query: async (text, params) => (await poolPromise).query(text, params),
  getPool: () => poolPromise,
};
