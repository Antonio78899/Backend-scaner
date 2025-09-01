const http = require('http');
const app = require('./app');

const PORT = process.env.SERVER_PORT || 3002;
const HOST = '0.0.0.0';

const server = http.createServer(app);
server.requestTimeout = 0;
server.headersTimeout = 0;
server.keepAliveTimeout = 0;

server.listen(PORT, HOST, () => {
  console.log(`✅ API escuchando en http://localhost:${PORT}`);
});
