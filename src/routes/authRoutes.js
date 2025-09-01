const express = require('express');
const { changePassword, register, login } = require('../controllers/authController.JS');

const router = express.Router();

// Sugerencia: usa /register solo para seeding/admin
router.post('/register', register);
router.post('/login', login);
router.patch('/change-password', changePassword);

module.exports = router;
