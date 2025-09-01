const {
  obtenerDatosDesdeMySQL,
  insertarDatosEnPostgres
} = require('../services/migracionServices');

const {
  crearTablaCodigos,
  verificarPorWarehouse,
  verificarPorGuia,
  obtenerTodos
} = require('../models/codigosModel');

const pool = require('../config/db');
const { getDeviceMeta } = require('../utils/device');

// Mapea canaln -> estado
function mapearEstadoDesdeCanaln(row) {
  if (!row || row.canaln == null) return null;
  const valor = String(row.canaln).trim().toLowerCase();
  if (valor === 'r') return 'ROJO';
  if (valor === 'v') return 'VERDE';
  return null;
}

// POST /migrar
const migrarDatos = async (_req, res) => {
  try {
    const rows = await obtenerDatosDesdeMySQL();
    await insertarDatosEnPostgres(rows);
    res.status(200).json({ message: '✅ Migración completada con éxito' });
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    res.status(500).json({ error: 'Error durante la migración' });
  }
};

// POST /verificar   { warehouse: "..." }
const verificarCodigo = async (req, res) => {
  const { warehouse } = req.body;
  if (!warehouse) return res.status(400).send('Código requerido');

  try {
    const codigo = String(warehouse).trim();
    const filas = await verificarPorWarehouse(codigo);

    let estado = 'DESCONOCIDO';
    if (Array.isArray(filas) && filas.length > 0) {
      estado = mapearEstadoDesdeCanaln(filas[0]) || 'DESCONOCIDO';
    }

    const { device_name, device_id } = getDeviceMeta(req);
    const usuario_id = req.user?.sub || null;

    await pool.query(
      `INSERT INTO log_verificaciones (device_name, device_id, codigo, resultado, usuario_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [device_name, device_id, codigo, estado, usuario_id]
    );

    // Incremento de rendimiento si ROJO/VERDE
    if (usuario_id && (estado === 'ROJO' || estado === 'VERDE')) {
      await pool.query(`UPDATE usuarios SET rendimiento = rendimiento + 1 WHERE id = $1`, [usuario_id]);
    }

    if (estado === 'ROJO') return res.status(200).send('⛔ CÓDIGO ROJO');
    if (estado === 'VERDE') return res.status(204).send();
    return res.status(404).send('❌ CÓDIGO DESCONOCIDO');
  } catch (err) {
    console.error('Error en verificarCodigo:', err);
    res.status(500).send('Error al verificar');
  }
};

// POST /verificarGuia   { guia: "..." }
const verificarCodigoG = async (req, res) => {
  const { guia } = req.body;
  if (!guia) return res.status(400).send('Código requerido');

  try {
    const codigo = String(guia).trim();
    const filas = await verificarPorGuia(codigo);

    let estado = 'DESCONOCIDO';
    if (Array.isArray(filas) && filas.length > 0) {
      estado = mapearEstadoDesdeCanaln(filas[0]) || 'DESCONOCIDO';
    }

    const { device_name, device_id } = getDeviceMeta(req);
    const usuario_id = req.user?.sub || null;

    await pool.query(
      `INSERT INTO log_verificaciones_guia (device_name, device_id, codigo, resultado, usuario_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [device_name, device_id, codigo, estado, usuario_id]
    );

    // Incremento de rendimiento si ROJO/VERDE
    if (usuario_id && (estado === 'ROJO' || estado === 'VERDE')) {
      await pool.query(`UPDATE usuarios SET rendimiento = rendimiento + 1 WHERE id = $1`, [usuario_id]);
    }

    if (estado === 'ROJO') return res.status(200).send('⛔ CÓDIGO ROJO');
    if (estado === 'VERDE') return res.status(204).send();
    return res.status(404).send('❌ Código desconocido (no existe en la base de datos)');
  } catch (err) {
    console.error('Error en verificarCodigoG:', err);
    res.status(500).send('Error al verificar');
  }
};

// GET /codigos
const obtenerCodigos = async (_req, res) => {
  try {
    const codigos = await obtenerTodos();
    res.status(200).json(codigos);
  } catch (error) {
    console.error('Error al obtener códigos:', error);
    res.status(500).send('Error del servidor');
  }
};

module.exports = {
  crearTablaCodigos,
  migrarDatos,
  verificarCodigo,
  verificarCodigoG,
  obtenerCodigos,
};
