const pool = require('../config/db');

const crearTablaCodigos = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS codigos_rojos (
      id SERIAL PRIMARY KEY,
      fecha DATE NOT NULL,
      warehouse VARCHAR(100) NOT NULL,
      guia VARCHAR(100) UNIQUE NOT NULL,
      canaln VARCHAR(10),
      departamento VARCHAR(50),
      provincia VARCHAR(50),
      distrito VARCHAR(50)
    )
  `);

  // Logs con usuario_id (NULL para compatibilidad)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS log_verificaciones (
      id SERIAL PRIMARY KEY,
      device_name VARCHAR(80) NOT NULL,
      device_id VARCHAR(128) NOT NULL,
      codigo VARCHAR(100) NOT NULL,
      resultado VARCHAR(20) NOT NULL,
      usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      fecha TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS log_verificaciones_guia (
      id SERIAL PRIMARY KEY,
      device_name VARCHAR(80) NOT NULL,
      device_id VARCHAR(128) NOT NULL,
      codigo VARCHAR(100) NOT NULL,
      resultado VARCHAR(20) NOT NULL,
      usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      fecha TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS log_verificaciones_guia_almacen (
      id SERIAL PRIMARY KEY,
      device_name VARCHAR(80) NOT NULL,
      device_id VARCHAR(128) NOT NULL,
      codigo VARCHAR(100) NOT NULL,
      resultado VARCHAR(20) NOT NULL,
      ubicacion VARCHAR(100),
      usuario_id INT REFERENCES usuarios(id) ON DELETE SET NULL,
      fecha TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_codigos_rojos_guia ON codigos_rojos(guia);`);
};

const obtenerTodos = async () => {
  const result = await pool.query('SELECT * FROM codigos_rojos ORDER BY id DESC');
  return result.rows;
};

const verificarPorWarehouse = async (warehouse) => {
  const result = await pool.query(
    `SELECT * FROM codigos_rojos WHERE warehouse = $1`,
    [warehouse.trim()]
  );
  return result.rows;
};

const verificarPorGuia = async (guia) => {
  const result = await pool.query(
    `SELECT * FROM codigos_rojos WHERE guia = $1`,
    [guia.trim()]
  );
  return result.rows;
};

module.exports = {
  crearTablaCodigos,
  obtenerTodos,
  verificarPorWarehouse,
  verificarPorGuia
};
