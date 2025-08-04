const {
  obtenerDatosDesdeMySQL,
  insertarDatosEnPostgres
} = require("../services/migracionServices");

const {
  crearTablaCodigos,
  verificarPorWarehouse,
  obtenerTodos
} = require("../models/codigosModel");

const migrarDatos = async (req, res) => {
  try {
    const rows = await obtenerDatosDesdeMySQL();
    await insertarDatosEnPostgres(rows);
    res.status(200).json({ message: '✅ Migración completada con éxito' });
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    res.status(500).json({ error: 'Error durante la migración' });
  }
};

const pool = require('../config/db'); // Asegúrate de importar pool aquí si no está

const verificarCodigo = async (req, res) => {
  const { warehouse } = req.body;
  if (!warehouse) return res.status(400).send("Código requerido");

  try {
    const codigo = warehouse.trim();
    const result = await verificarPorWarehouse(codigo);

    const estado = result.length > 0 ? "ROJO" : "VERDE";

    // Registrar log en la tabla log_verificaciones
    await pool.query(
      `INSERT INTO log_verificaciones (codigo, resultado) VALUES ($1, $2)`,
      [codigo, estado]
    );

    if (estado === "ROJO") {
      return res.status(200).send("⛔ CÓDIGO ROJO");
    } else {
      return res.status(204).send(); // permitido
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error al verificar");
  }
};


const obtenerCodigos = async (_req, res) => {
  try {
    const codigos = await obtenerTodos();
    res.status(200).json(codigos);
  } catch (error) {
    console.error("Error al obtener códigos:", error);
    res.status(500).send("Error del servidor");
  }
};

module.exports = {
  crearTablaCodigos,
  migrarDatos,
  verificarCodigo,
  obtenerCodigos,
};
