const app = require("./app");
const { crearTablaCodigos } = require("./controllers/codigosController");

const PORT = process.env.SERVER_PORT || 3002;

app.listen(PORT, async () => {
  await crearTablaCodigos();
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
