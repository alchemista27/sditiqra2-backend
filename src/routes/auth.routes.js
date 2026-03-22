// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/login - Login semua user (Admin, Guru, Karyawan)
router.post('/login', authController.login);

// POST /api/auth/register-parent - Khusus pendaftar PPDB
router.post('/register-parent', authController.registerParent);

// GET /api/auth/me - Mendapatkan info user yang sedang login
router.get('/me', authenticate, authController.getMe);

module.exports = router;
