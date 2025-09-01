const express = require("express");
const { auth } = require("../middlewares/auth.middleware");
const { registrarScan } = require("../controllers/logs.controller");
const router = express.Router();

router.post("/scan", auth(), registrarScan);

module.exports = router;
