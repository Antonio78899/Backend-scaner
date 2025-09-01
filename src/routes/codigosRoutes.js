const express = require("express");
const multer = require("multer");

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

const {
  migrarDatos,
  verificarCodigo,
  verificarCodigoG,
  obtenerCodigos
} = require("../controllers/codigosControllerRojos.js");

const {
  verificarCodigoGuia,
  cargarUbicacionesExcel
} = require("../controllers/codigosControllerAlmacen.js");

router.get("/agregar", migrarDatos);
router.post("/verificar", verificarCodigo);
router.post("/verificarGuia", verificarCodigoG);
router.get("/todos", obtenerCodigos);
router.post("/verificarGuiaAlmacen", verificarCodigoGuia);
router.post(
  "/cargarUbicacionesExcel",
  upload.single("file"),
  cargarUbicacionesExcel
);

module.exports = router;
