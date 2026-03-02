// src/routes/attendance.routes.js
const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { authenticate, authorize } = require('../middleware/auth');

// ─── KARYAWAN (Guru & Staf) ────────────────────────────────

// Harusnya memakai authenticate dan authorization GURU / STAF
router.use(authenticate);

// Catat Kehadiran
router.post('/clock-in', attendanceController.clockIn);
router.post('/clock-out', attendanceController.clockOut);

// Histori Pribadi
router.get('/my-logs', attendanceController.getMyLogs);

// ─── ADMIN (Kepala Sekolah & HRD / Admin CMS) ──────────────

router.get('/logs/today', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH', 'ADMIN_CMS'), attendanceController.getAllLogsToday);
router.get('/employees', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH', 'ADMIN_CMS'), attendanceController.getAllEmployees);

module.exports = router;
