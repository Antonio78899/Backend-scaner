const express = require("express");
const router = express.Router();
const {
  migrarDatos,
  verificarCodigo,
  verificarCodigoG,
  obtenerCodigos
} = require("../controllers/codigosController.js");

router.get("/agregar", migrarDatos);
router.post("/verificar", verificarCodigo);
router.post("/verificarGuia", verificarCodigoG);
router.get("/todos", obtenerCodigos);

module.exports = router;
