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

  // Índices útiles en fechas y por usuario
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_log_verificaciones_fecha ON log_verificaciones(fecha);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_log_verificaciones_guia_fecha ON log_verificaciones_guia(fecha);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_log_verificaciones_guia_almacen_fecha ON log_verificaciones_guia_almacen(fecha);`);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_log_verificaciones_usuario ON log_verificaciones(usuario_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_log_verificaciones_guia_usuario ON log_verificaciones_guia(usuario_id);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_log_verificaciones_guia_almacen_usuario ON log_verificaciones_guia_almacen(usuario_id);`);

  // Vista unificada de escaneos (si no existe)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_views WHERE viewname = 'v_scans_all'
      ) THEN
        CREATE VIEW v_scans_all AS
        SELECT usuario_id, fecha FROM log_verificaciones WHERE usuario_id IS NOT NULL
        UNION ALL
        SELECT usuario_id, fecha FROM log_verificaciones_guia WHERE usuario_id IS NOT NULL
        UNION ALL
        SELECT usuario_id, fecha FROM log_verificaciones_guia_almacen WHERE usuario_id IS NOT NULL;
      END IF;
    END $$;
  `);
}

async function initDb() {
  await crearTablaUsuarios();
  await crearTablaCodigos();
  await ensureLogColumns();
}

module.exports = { initDb };
