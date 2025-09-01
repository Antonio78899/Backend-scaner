const pool = require('../config/db');
const { crearTablaUsuarios } = require('./usuarioModel');
const { crearTablaCodigos } = require('./codigosModel');

async function ensureLogColumns() {
  // Asegura columnas usuario_id por si ya existían logs
  await pool.query(`
    ALTER TABLE IF EXISTS log_verificaciones
      ADD COLUMN IF NOT EXISTS usuario_id INT NULL REFERENCES usuarios(id) ON DELETE SET NULL;
  `);
  await pool.query(`
    ALTER TABLE IF EXISTS log_verificaciones_guia
      ADD COLUMN IF NOT EXISTS usuario_id INT NULL REFERENCES usuarios(id) ON DELETE SET NULL;
  `);
  await pool.query(`
    ALTER TABLE IF EXISTS log_verificaciones_guia_almacen
      ADD COLUMN IF NOT EXISTS usuario_id INT NULL REFERENCES usuarios(id) ON DELETE SET NULL;
  `);

  // Índices útiles en fechas
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_log_verificaciones_fecha ON log_verificaciones(fecha);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_log_verificaciones_guia_fecha ON log_verificaciones_guia(fecha);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_log_verificaciones_guia_almacen_fecha ON log_verificaciones_guia_almacen(fecha);`);
}

async function initDb() {
  await crearTablaUsuarios();
  await crearTablaCodigos();
  await ensureLogColumns();
}

module.exports = { initDb };
