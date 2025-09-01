// etl.js
const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const dayjs = require('dayjs');

// En producción (Render) NO se usa .env.local: las env vars vienen del panel de Render
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  require('dotenv').config({ path: '.env.local' });
}

/* ========== MySQL: usa ngrok si lees desde tu LAN ========== */
const mysqlPool = mysql.createPool({
  host: process.env.MYSQL_HOST,             // ej: 0.tcp.ngrok.io
  port: Number(process.env.MYSQL_PORT || 3306), // ej: 12345
  user: process.env.MYSQL_USER,             // crea un usuario de solo lectura
  password: process.env.MYSQL_PASS,
  database: process.env.MYSQL_DB,
  waitForConnections: true,
  connectionLimit: 3,    // free-friendly
  connectTimeout: 20000,
  queueLimit: 0,
});

async function obtenerDatosDesdeMySQL() {
  const fechaInicio = dayjs().subtract(15, 'days').format('YYYY-MM-DD');

  const sql = `
    SELECT fecha, warehouse, canaln, guia FROM mst_warehouse_c
    WHERE fecha >= ? AND canaln IN ('R', 'V')
    UNION ALL
    SELECT fecha, warehouse, canaln, guia FROM mst_warehousext_c
    WHERE fecha >= ? AND canaln IN ('R', 'V')
    UNION ALL
    SELECT fecha, warehouse, canaln, guia FROM mst_warehousext_s
    WHERE fecha >= ? AND canaln IN ('R', 'V')
  `;

  const [rows] = await mysqlPool.execute(sql, [fechaInicio, fechaInicio, fechaInicio]);
  return rows;
}

/* ========== Postgres: usa SIEMPRE DATABASE_URL (cloud) + SSL ========== */
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no está definida. En Render, configúrala en Settings → Environment.');
}

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL, // Supabase/Neon/Render PG
  ssl: { rejectUnauthorized: false },         // necesario en la mayoría de free tiers
  max: 5,
  idleTimeoutMillis: 0,
});

async function insertarDatosEnPostgres(rows) {
  const fechaInicio = dayjs().subtract(15, 'days').format('YYYY-MM-DD');

  // Limpieza por retención (usa índice en fecha)
  await pgPool.query('DELETE FROM codigos_rojos WHERE fecha < $1', [fechaInicio]);
  console.log(`🗑️ Registros < ${fechaInicio} eliminados de codigos_rojos`);

  // Upsert en bloques para rendimiento
  const chunkSize = 500;
  let procesadas = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    const values = [];
    const params = [];
    let p = 1;

    for (const r of chunk) {
      const fecha = r.fecha; // 'YYYY-MM-DD' o Date
      const warehouse = (r.warehouse ?? '').toString().trim() || 'DESCONOCIDO';
      const guia = (r.guia ?? '').toString().trim();
      const canaln = (r.canaln ?? '').toString().trim().toUpperCase();
      if (!guia) continue;

      values.push(`($${p++}, $${p++}, $${p++}, $${p++})`);
      params.push(fecha, warehouse, guia, canaln);
    }

    if (!values.length) continue;

    const upsertSQL = `
      INSERT INTO codigos_rojos (fecha, warehouse, guia, canaln)
      VALUES ${values.join(',')}
      ON CONFLICT (guia) DO UPDATE
      SET fecha = EXCLUDED.fecha,
          warehouse = EXCLUDED.warehouse,
          canaln = EXCLUDED.canaln
    `;

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(upsertSQL, params);
      await client.query('COMMIT');
      procesadas += (values.length);
      console.log(`✅ Bloque ${i}… procesado`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Error en bloque:', err.message);
    } finally {
      client.release();
    }
  }

  console.log(`🏁 Upsert completado: ${procesadas}/${rows.length} filas consideradas`);
}

module.exports = { obtenerDatosDesdeMySQL, insertarDatosEnPostgres };
