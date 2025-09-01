const XLSX = require('xlsx');
const { verificarPorGuia } = require('../models/codigosModel');
const pool = require('../config/db');
const { getDeviceMeta } = require('../utils/device');

/* ----------------------- Helpers ----------------------- */
function _norm(v) { return (v ?? '').toString().trim(); }

function _normalizarLimaPosible(str) {
  const s = _norm(str).toLowerCase();
  if (!s) return '';
  if (s === 'lima metropolitana' || s === 'lima metropólitana') return 'Lima';
  return _norm(str);
}

function mapearEstadoDesdeCanaln(row) {
  if (!row || row.canaln == null) return null;
  const valor = String(row.canaln).trim().toLowerCase();
  if (valor === 'r') return 'ROJO';
  if (valor === 'v') return 'VERDE';
  return null;
}

function mapearUbicacion(row) {
  if (!row) return null;
  const dep  = _normalizarLimaPosible(row.departamento);
  const prov = _normalizarLimaPosible(row.provincia);
  const dist = _norm(row.distrito);
  if (!dep) return null;

  const isDepLima  = dep.toLowerCase() === 'lima';
  const isProvLima = prov.toLowerCase() === 'lima';

  if (!isDepLima) return dep.toUpperCase();
  if (!isProvLima) return (prov || dep).toUpperCase();
  const partes = [prov.toUpperCase()];
  if (dist) partes.push(dist.toUpperCase());
  return partes.join(' - ');
}

function _findHeaderIndex(headerRow, candidates = []) {
  const norm = (t) => _norm(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const hdr = headerRow.map(h => norm(h));
  for (const cand of candidates.map(norm)) {
    const idx = hdr.findIndex(h => h === cand);
    if (idx >= 0) return idx;
  }
  return -1;
}

/* ----------------------- Endpoints de almacén ----------------------- */

const verificarCodigoGuia = async (req, res) => {
  const { guia } = req.body;
  if (!guia) return res.status(400).json({ error: 'Código requerido' });

  try {
    const codigo = String(guia).trim();
    const filas = await verificarPorGuia(codigo);

    let estado = 'DESCONOCIDO';
    let ubicacionTexto = null;
    let datosUbicacion = { departamento: null, provincia: null, distrito: null, texto: null };

    if (Array.isArray(filas) && filas.length > 0) {
      const row = filas[0];
      estado = mapearEstadoDesdeCanaln(row) || 'DESCONOCIDO';
      ubicacionTexto = mapearUbicacion(row);
      datosUbicacion = {
        departamento: _normalizarLimaPosible(row.departamento).toUpperCase() || null,
        provincia: _normalizarLimaPosible(row.provincia).toUpperCase() || null,
        distrito: _norm(row.distrito).toUpperCase() || null,
        texto: ubicacionTexto
      };
    }

    const { device_name, device_id } = getDeviceMeta(req);
    const usuario_id = req.user?.sub || null;

    await pool.query(
      `INSERT INTO log_verificaciones_guia_almacen (device_name, device_id, codigo, resultado, ubicacion, usuario_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [device_name, device_id, codigo, estado, ubicacionTexto, usuario_id]
    );

    // ⬇️ incremento de rendimiento si ROJO/VERDE
    if (usuario_id && (estado === 'ROJO' || estado === 'VERDE')) {
      await pool.query(`UPDATE usuarios SET rendimiento = rendimiento + 1 WHERE id = $1`, [usuario_id]);
    }

    if (estado === 'ROJO') {
      return res.status(200).json({ estado: 'ROJO', ...datosUbicacion, mensaje: '⛔ CÓDIGO ROJO' });
    }
    if (estado === 'VERDE') {
      return res.status(200).json({ estado: 'VERDE', ...datosUbicacion, permitido: true });
    }
    return res.status(404).json({ estado: 'DESCONOCIDO', ...datosUbicacion, mensaje: '❌ Código desconocido (no existe en la base de datos)' });
  } catch (err) {
    console.error('Error en verificarCodigoGuia:', err);
    res.status(500).json({ error: 'Error al verificar' });
  }
};

const cargarUbicacionesExcel = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'Sube un archivo Excel en el campo "file"' });
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    if (aoa.length < 2) {
      return res.status(400).json({ error: 'El Excel no tiene datos (solo encabezado o vacío)' });
    }

    const DEFAULT_IDX_GUIA = 16;  // Q
    const DEFAULT_IDX_DEP  = 9;   // J
    const DEFAULT_IDX_PROV = 10;  // K
    const DEFAULT_IDX_DIST = 11;  // L
    const DEFAULT_IDX_WARE = 28;  // AC

    const headerRow = aoa[0];
    let IDX_GUIA = DEFAULT_IDX_GUIA;
    const hdrQ = _norm(headerRow[IDX_GUIA]).toLowerCase();
    const warning = hdrQ && !['invoice no.', 'invoice no', 'invoice'].includes(hdrQ)
      ? `Advertencia: en la columna Q esperaba "Invoice No.", pero encontré "${headerRow[IDX_GUIA]}". Se usará igualmente la columna Q.`
      : null;

    let IDX_WARE = _findHeaderIndex(headerRow, ['carton', 'cartón']);
    if (IDX_WARE < 0) IDX_WARE = DEFAULT_IDX_WARE;

    const byGuia = new Map();
    for (let i = 1; i < aoa.length; i++) {
      const row = aoa[i] || [];
      const guia = _norm(row[IDX_GUIA]);
      if (!guia) continue;

      const dep   = _normalizarLimaPosible(row[DEFAULT_IDX_DEP]);
      const prov  = _normalizarLimaPosible(row[DEFAULT_IDX_PROV]);
      const dist  = _norm(row[DEFAULT_IDX_DIST]);
      const ware  = _norm(row[IDX_WARE]);

      if (!byGuia.has(guia)) {
        byGuia.set(guia, { guia, dep: '', prov: '', dist: '', warehouse: '' });
      }
      const acc = byGuia.get(guia);
      if (dep)       acc.dep       = dep;
      if (prov)      acc.prov      = prov;
      if (dist)      acc.dist      = dist;
      if (ware)      acc.warehouse = ware;
    }

    const items = Array.from(byGuia.values());
    if (items.length === 0) {
      return res.status(400).json({ error: 'No se encontraron guías válidas en la columna Q (Invoice No.)' });
    }

    const guias = items.map(x => x.guia);
    const deps  = items.map(x => x.dep);
    const provs = items.map(x => x.prov);
    const dists = items.map(x => x.dist);

    const updateResult = await pool.query(
      `
      WITH data AS (
        SELECT
          unnest($1::text[]) AS guia,
          unnest($2::text[]) AS departamento,
          unnest($3::text[]) AS provincia,
          unnest($4::text[]) AS distrito
      )
      UPDATE codigos_rojos c
      SET
        departamento = CASE WHEN NULLIF(btrim(d.departamento),'') IS NOT NULL THEN btrim(d.departamento) ELSE c.departamento END,
        provincia    = CASE WHEN NULLIF(btrim(d.provincia),'')    IS NOT NULL THEN btrim(d.provincia)    ELSE c.provincia    END,
        distrito     = CASE WHEN NULLIF(btrim(d.distrito),'')     IS NOT NULL THEN btrim(d.distrito)     ELSE c.distrito     END
      FROM data d
      WHERE c.guia = d.guia
      RETURNING c.guia, c.departamento, c.provincia, c.distrito;
      `,
      [guias, deps, provs, dists]
    );

    const updatedSet = new Set(updateResult.rows.map(r => r.guia));
    const noEncontradas = guias.filter(g => !updatedSet.has(g));

    let insertadas = 0;
    let muestraInsertadas = [];
    if (noEncontradas.length > 0) {
      const porGuia = new Map(items.map(it => [it.guia, it]));
      const guiasNew = [], depsNew = [], provsNew = [], distsNew = [], wareNew = [];

      for (const g of noEncontradas) {
        const it = porGuia.get(g) || { dep: '', prov: '', dist: '', warehouse: '' };
        guiasNew.push(g);
        depsNew.push(it.dep || '');
        provsNew.push(it.prov || '');
        distsNew.push(it.dist || '');
        wareNew.push(it.warehouse || '');
      }

      const insertResult = await pool.query(
        `
        WITH data AS (
          SELECT
            unnest($1::text[]) AS guia,
            unnest($2::text[]) AS departamento,
            unnest($3::text[]) AS provincia,
            unnest($4::text[]) AS distrito,
            unnest($5::text[]) AS warehouse
        )
        INSERT INTO codigos_rojos (guia, departamento, provincia, distrito, warehouse, fecha)
        SELECT
          btrim(guia),
          NULLIF(btrim(departamento),''),
          NULLIF(btrim(provincia),''),
          NULLIF(btrim(distrito),''),
          NULLIF(btrim(warehouse),''),
          NOW() - interval '3 days'
        FROM data
        ON CONFLICT (guia) DO NOTHING
        RETURNING guia, departamento, provincia, distrito, warehouse, fecha;
        `,
        [guiasNew, depsNew, provsNew, distsNew, wareNew]
      );

      insertadas = insertResult.rowCount || 0;
      muestraInsertadas = insertResult.rows.slice(0, 20);
    }

    console.log(`Actualizadas ${updateResult.rowCount} | Insertadas ${insertadas}`);

    return res.status(200).json({
      hoja: sheetName,
      total_guias_en_excel: guias.length,
      actualizadas: updateResult.rowCount,
      insertadas,
      no_encontradas: noEncontradas,
      muestra_actualizadas: updateResult.rows.slice(0, 20),
      muestra_insertadas: muestraInsertadas,
      ...(warning ? { warning } : {})
    });
  } catch (err) {
    console.error('Error en cargarUbicacionesExcel:', err);
    return res.status(500).json({ error: 'Error procesando el Excel' });
  }
};

module.exports = { verificarCodigoGuia, cargarUbicacionesExcel };
