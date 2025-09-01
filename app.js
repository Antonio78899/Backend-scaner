const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '.env.local' });

const { initDb } = require('./src/models/dbInit');
const authRoutes = require('./src/routes/authRoutes');
const apiRoutes = require('./src/routes/apiRoutes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Inicializa/actualiza tablas e índices al arrancar
initDb().then(() => console.log('🗄️ DB lista')).catch(console.error);

// Rutas
app.use('/auth', authRoutes);
app.use(apiRoutes);

module.exports = app;
