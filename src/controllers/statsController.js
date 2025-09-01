const { getUserScanStats, getUserDailySeries } = require('../services/statsServices');

const getMyStats = async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'No autorizado' });

    const [totales, ultimos7dias] = await Promise.all([
      getUserScanStats(userId, 'America/Lima'),
      getUserDailySeries(userId, 7, 'America/Lima')
    ]);

    res.json({ totales, ultimos7dias });
  } catch (e) {
    console.error('Error en getMyStats:', e);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
};

module.exports = { getMyStats };
