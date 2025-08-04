const express = require("express");
const cors = require("cors");
const app = express();

const codigosRoutes = require("./routes/codigosRoutes");

app.use(cors());
app.use(express.json());

// Rutas
app.use("/", codigosRoutes);

module.exports = app;
