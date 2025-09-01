// Guardado en memoria. En producción: usar Redis o similar si hay múltiples instancias.
const LAST_ACTIVITY = new Map(); // userId -> timestamp (ms)

const requireActiveSession = (maxIdleMs = 30 * 60 * 1000) => (req, res, next) => {
  const uid = req.user?.sub;
  if (!uid) return res.status(401).json({ error: 'No autorizado' });

  const now = Date.now();
  const last = LAST_ACTIVITY.get(uid);

  // Si hay registro y excede el idle permitido -> expira
  if (last && (now - last) > maxIdleMs) {
    LAST_ACTIVITY.delete(uid);
    return res.status(401).json({ error: 'Sesión expirada por inactividad' });
  }

  // Si no hay registro o aún está dentro del margen -> actualiza y deja pasar
  LAST_ACTIVITY.set(uid, now);
  next();
};

module.exports = { requireActiveSession };
