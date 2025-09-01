const pool = require('../config/db');

// Stats totales del usuario (hoy / semana / mes) usando timezone
async function getUserScanStats(userId, tz = 'America/Lima') {
  const q = `
    WITH scans AS (
      SELECT usuario_id, fecha AT TIME ZONE 'UTC' AT TIME ZONE $2 AS fecha_local
      FROM v_scans_all
      WHERE usuario_id = $1
    )
    SELECT
      (SELECT COUNT(*) FROM scans WHERE fecha_local::date = (CURRENT_DATE AT TIME ZONE $2)) AS hoy,
      (SELECT COUNT(*) FROM scans WHERE date_trunc('week', fecha_local) = date_trunc('week', (CURRENT_TIMESTAMP AT TIME ZONE $2))) AS semana,
      (SELECT COUNT(*) FROM scans WHERE date_trunc('month', fecha_local) = date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE $2))) AS mes;
  `;
  const { rows } = await pool.query(q, [userId, tz]);
  return rows[0] || { hoy: 0, semana: 0, mes: 0 };
}

// Serie diaria últimos N días (incluye hoy)
async function getUserDailySeries(userId, days = 7, tz = 'America/Lima') {
  const q = `
    WITH series AS (
      SELECT generate_series(0, $3 - 1) AS offset_d
    ),
    scans AS (
      SELECT (fecha AT TIME ZONE 'UTC' AT TIME ZONE $2)::date AS d
      FROM v_scans_all
      WHERE usuario_id = $1
    )
    SELECT
      (CURRENT_DATE AT TIME ZONE $2 - (interval '1 day' * s.offset_d))::date AS dia,
      COALESCE( (SELECT COUNT(*) FROM scans sc WHERE sc.d = (CURRENT_DATE AT TIME ZONE $2 - (interval '1 day' * s.offset_d))::date), 0) AS total
    FROM series s
    ORDER BY dia;
  `;
  const { rows } = await pool.query(q, [userId, tz, days]);
  return rows;
}

module.exports = { getUserScanStats, getUserDailySeries };
