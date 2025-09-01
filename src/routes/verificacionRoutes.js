const express = require("express");
const { auth } = require("../middlewares/auth.middleware");
const { getTodos, getPorWarehouse, getPorGuia } = require("../controllers/verificacion.controller");
const router = express.Router();

router.get("/todos", auth(), getTodos);
router.get("/warehouse/:wh", auth(), getPorWarehouse);
router.get("/guia/:guia", auth(), getPorGuia);

module.exports = router;
