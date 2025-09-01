const express = require('express');
const multer = require('multer');
const { auth } = require('../middlewares/authMiddleware');
const { requireActiveSession } = require('../middlewares/activityMiddleware');

const codigosRojos = require('../controllers/codigosControllerRojos');
const codigosAlmacen = require('../controllers/codigosControllerAlmacen');

const upload = multer();
const router = express.Router();

// Todas protegidas con auth() y control de inactividad:
// (30 min por defecto; si quieres otro valor, pásalo a requireActiveSession(ms))

router.post('/migrar', auth(), requireActiveSession(), codigosRojos.migrarDatos);
router.post('/verificar', auth(), requireActiveSession(), codigosRojos.verificarCodigo);
router.post('/verificarGuia', auth(), requireActiveSession(), codigosRojos.verificarCodigoG);
router.post('/verificarGuiaAlmacen', auth(), requireActiveSession(), codigosAlmacen.verificarCodigoGuia);

router.post('/codigos/ubicaciones-excel', auth(), requireActiveSession(), upload.single('file'), codigosAlmacen.cargarUbicacionesExcel);
router.get('/codigos', auth(), requireActiveSession(), codigosRojos.obtenerCodigos);

module.exports = router;
