// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');

// Rate limiter khusus untuk endpoint sensitif (max 5 percobaan per menit)
// NOTE: Menggunakan in-memory store yang hanya efektif untuk deployment single-instance.
// Ditempatkan setelah authenticate agar bisa menggunakan user ID sebagai key
const changePasswordLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 menit
  max: 5,
  message: 'Terlalu banyak percobaan ubah password. Silakan coba lagi dalam 1 menit.',
});

// POST /api/auth/login - Login semua user (Admin, Guru, Karyawan)
router.post('/login', authController.login);

// POST /api/auth/register-parent - Khusus pendaftar PPDB
router.post('/register-parent', authController.registerParent);

// GET /api/auth/me - Mendapatkan info user yang sedang login
router.get('/me', authenticate, authController.getMe);

// PUT /api/auth/change-password - Mengubah password user yang sedang login
router.put('/change-password', authenticate, changePasswordLimiter, authController.changePassword);

module.exports = router;
