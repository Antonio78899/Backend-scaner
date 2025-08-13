const pool = require("../config/db");

const crearTablaCodigos = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS codigos_rojos (
      id SERIAL PRIMARY KEY,
      fecha DATE NOT NULL,
      warehouse VARCHAR(100) NOT NULL,
      guia VARCHAR(100) UNIQUE NOT NULL,
      canaln VARCHAR(10) NOT NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS log_verificaciones (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(100) NOT NULL,
      resultado VARCHAR(10) NOT NULL, -- 'ROJO' o 'VERDE'
      fecha TIMESTAMP DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS log_verificaciones_guia (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(100) NOT NULL,
      resultado VARCHAR(10) NOT NULL, -- 'ROJO' o 'VERDE'
      fecha TIMESTAMP DEFAULT NOW()
    );
  `);
};

const obtenerTodos = async () => {
  const result = await pool.query("SELECT * FROM codigos_rojos ORDER BY id DESC");
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
