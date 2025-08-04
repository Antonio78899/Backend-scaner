const mysql = require('mysql2/promise');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function obtenerDatosDesdeMySQL() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    port: process.env.MYSQL_PORT,
    database: process.env.MYSQL_DB
  });

  const [rows] = await connection.execute(`
    SELECT fecha, warehouse, canaln, guia FROM mst_warehouse_c
    WHERE canaln = 'R' AND fecha >= '2025-07-01'
    UNION ALL
    SELECT fecha, warehouse, canaln, guia FROM mst_warehousext_c
    WHERE canaln = 'R' AND fecha >= '2025-07-01'
    UNION ALL
    SELECT fecha, warehouse, canaln, guia FROM mst_warehousext_s
    WHERE canaln = 'R' AND fecha >= '2025-07-01'
  `);

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

    let insertados = 0;
    for (const row of rows) {
      try {
        await pgClient.query(
          `INSERT INTO codigos_rojos (fecha, warehouse, guia, canaln)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (guia) DO NOTHING`,
          [row.fecha, row.warehouse, row.guia, row.canaln]
        );
        insertados++;
      } catch (error) {
        console.error('Error al insertar fila:', row, error);
      }
    }

    console.log(`✅ Inserción completada: ${insertados}/${rows.length} filas insertadas`);
  } catch (err) {
    console.error("❌ Error en la conexión o en la migración:", err.message);
    throw err;
  } finally {
    await pgClient.end();
  }
}

module.exports = {
  obtenerDatosDesdeMySQL,
  insertarDatosEnPostgres
};
