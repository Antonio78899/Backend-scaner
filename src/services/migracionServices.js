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

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function insertarDatosEnPostgres(rows, {chunkSize = 500, maxRetries = 3} = {}) {
  const fechaInicio = dayjs().subtract(15, 'days').format('YYYY-MM-DD');

  // 1) Limpieza por retención
  await pgPool.query('DELETE FROM codigos_rojos WHERE fecha < $1', [fechaInicio]);
  console.log(`🗑️ Registros < ${fechaInicio} eliminados de codigos_rojos`);

  // 2) Helper para construir VALUES/params desde filas crudas
  const buildValuesParams = (sourceRows) => {
    const values = [];
    const params = [];
    let p = 1;
    for (const r of sourceRows) {
      const fecha = r.fecha;
      const warehouse = (r.warehouse ?? '').toString().trim() || 'DESCONOCIDO';
      const guia = (r.guia ?? '').toString().trim();
      const canaln = (r.canaln ?? '').toString().trim().toUpperCase();
      if (!guia) continue; // saltar vacíos
      values.push(`($${p++}, $${p++}, $${p++}, $${p++})`);
      params.push(fecha, warehouse, guia, canaln);
    }
    return { values, params };
  };

  // 3) Helper para ejecutar un upsert de N filas
  const executeUpsert = async (values, params) => {
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
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  };

  let procesadas = 0;
  const fallidas = []; // aquí guardamos filas crudas de cada bloque fallido

  // 4) Primera pasada por bloques
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { values, params } = buildValuesParams(chunk);
    if (!values.length) continue;

    try {
      await executeUpsert(values, params);
      procesadas += values.length;
      console.log(`✅ Bloque ${i}-${i + chunk.length - 1} procesado (${values.length} filas)`);
    } catch (err) {
      console.error(`❌ Error en bloque ${i}-${i + chunk.length - 1}: ${err.code || ''} ${err.message}`);
      // Guardar filas crudas para reintentos al final
      fallidas.push(...chunk);
    }
  }

  // 5) Reintentos al final (exponencial)
  if (fallidas.length) {
    console.warn(`🔁 Reintentando ${fallidas.length} filas fallidas en hasta ${maxRetries} intentos...`);
    let pendientes = fallidas;

    for (let intento = 1; intento <= maxRetries && pendientes.length; intento++) {
      const esperaMs = 500 * Math.pow(2, intento - 1); // 500ms, 1s, 2s...
      if (intento > 1) {
        console.log(`⏳ Esperando ${esperaMs} ms antes del intento ${intento}...`);
        await sleep(esperaMs);
      }

      const reintentosFallidos = [];
      // reprocesar en minichunks para no tirar todo junto (mejor diagnóstico)
      for (let j = 0; j < pendientes.length; j += Math.min(200, chunkSize)) {
        const mini = pendientes.slice(j, j + Math.min(200, chunkSize));
        const { values, params } = buildValuesParams(mini);
        if (!values.length) continue;

        try {
          await executeUpsert(values, params);
          procesadas += values.length;
          console.log(`✅ Reintento ${intento}: ${values.length} filas ok (mini ${j}-${j + mini.length - 1})`);
        } catch (err) {
          console.error(`❌ Reintento ${intento} falló (mini ${j}-${j + mini.length - 1}): ${err.code || ''} ${err.message}`);
          reintentosFallidos.push(...mini);
        }
      }

      pendientes = reintentosFallidos;
      if (!pendientes.length) break;
      console.warn(`⚠️ Aún pendientes tras intento ${intento}: ${pendientes.length}`);
    }

    if (pendientes.length) {
      console.error(`🚨 No se pudieron insertar ${pendientes.length} filas tras ${maxRetries} reintentos.`);
      // Opcional: guardar a disco para análisis posterior
      try {
        const fs = require('fs');
        const path = require('path');
        const dumpPath = path.join(process.cwd(), `codigos_rojos_pendientes_${Date.now()}.json`);
        fs.writeFileSync(dumpPath, JSON.stringify(pendientes, null, 2), 'utf8');
        console.error(`🧾 Dump de filas pendientes: ${dumpPath}`);
      } catch (e) {
        console.error('No se pudo guardar el dump de pendientes:', e.message);
      }
    }
  }

  console.log(`🏁 Upsert completado: ${procesadas}/${rows.length} filas consideradas`);
}


module.exports = { obtenerDatosDesdeMySQL, insertarDatosEnPostgres };
