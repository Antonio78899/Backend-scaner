const mysql = require('mysql2/promise');
const { Client } = require('pg');
const dayjs = require('dayjs');
require('dotenv').config({ path: '.env.local' });

async function obtenerDatosDesdeMySQL() {
  const fechaInicio = dayjs().subtract(15, 'days').format('YYYY-MM-DD');

  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    port: process.env.MYSQL_PORT,
    database: process.env.MYSQL_DB
  });

  const [rows] = await connection.execute(`
    SELECT fecha, warehouse, canaln, guia FROM mst_warehouse_c
    WHERE fecha >= ? AND canaln IN ('R', 'V')
    UNION ALL
    SELECT fecha, warehouse, canaln, guia FROM mst_warehousext_c
    WHERE fecha >= ? AND canaln IN ('R', 'V')
    UNION ALL
    SELECT fecha, warehouse, canaln, guia FROM mst_warehousext_s
    WHERE fecha >= ? AND canaln IN ('R', 'V')
  `, [fechaInicio, fechaInicio, fechaInicio]);

  await connection.end();
  return rows;
}

async function insertarDatosEnPostgres(rows) {
  const pgClient = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });

  try {
    await pgClient.connect();
    const fechaInicio = dayjs().subtract(15, 'days').format('YYYY-MM-DD');

    await pgClient.query('DELETE FROM codigos_rojos WHERE fecha < $1', [fechaInicio]);
    console.log(`🗑️ Registros anteriores a ${fechaInicio} eliminados de codigos_rojos`);

    await pgClient.query('BEGIN');

    const upsertSQL = `
      INSERT INTO codigos_rojos (fecha, warehouse, guia, canaln)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (guia) DO UPDATE
      SET canaln = EXCLUDED.canaln
    `;

    let procesadas = 0;
    for (const row of rows) {
      const fecha = row.fecha;
      const warehouse = (row.warehouse ?? '').toString().trim() || 'DESCONOCIDO';
      const guia = (row.guia ?? '').toString().trim();
      const canaln = (row.canaln ?? '').toString().trim().toUpperCase();

      if (!guia) continue;

      try {
        await pgClient.query(upsertSQL, [fecha, warehouse, guia, canaln]);
        procesadas++;
      } catch (error) {
        console.error('Error al upsert fila:', { guia, fecha, warehouse, canaln }, error.message);
      }
    }

    await pgClient.query('COMMIT');
    console.log(`✅ Upsert completado: ${procesadas}/${rows.length} filas procesadas`);
  } catch (err) {
    await pgClient.query('ROLLBACK').catch(() => {});
    console.error('❌ Error en la conexión o en la migración:', err.message);
    throw err;
  } finally {
    await pgClient.end();
  }
}

module.exports = {
  obtenerDatosDesdeMySQL,
  insertarDatosEnPostgres
};
