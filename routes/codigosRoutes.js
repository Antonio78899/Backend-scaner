const express = require("express");
const router = express.Router();
const {
  migrarDatos,
  verificarCodigo,
  obtenerCodigos
} = require("../controllers/codigosController.js");

router.get("/agregar", migrarDatos);
router.post("/verificar", verificarCodigo);
router.get("/todos", obtenerCodigos);

module.exports = router;
