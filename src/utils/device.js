function getDeviceMeta(req) {
  const device_name = req.headers['x-device-name'] || req.body?.deviceName || 'DESCONOCIDO';
  const device_id = req.headers['x-device-id'] || req.body?.deviceId || null;
  return { device_name, device_id };
}

module.exports = { getDeviceMeta };
