// src/routes/attendance.routes.js
const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

// ─── Semua routes attendance perlu authentication ─────────────
router.use(authenticate);

// ─── KARYAWAN (Guru & Staf) ────────────────────────────────
router.get('/config', attendanceController.getConfig);
router.post('/upload-selfie', upload.single('selfie'), attendanceController.uploadSelfie);
router.post('/clock-in', attendanceController.clockIn);
router.post('/clock-out', attendanceController.clockOut);
router.get('/my-logs', attendanceController.getMyLogs);
router.get('/my-status', attendanceController.getMyStatus);

// ─── ADMIN (Kepala Sekolah & Admin) ──────────────────────────
router.put('/config', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH'), attendanceController.updateConfig);
router.get('/logs/today', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH', 'ADMIN_CMS'), attendanceController.getAllLogsToday);
router.get('/logs', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH', 'ADMIN_CMS'), attendanceController.getAllLogs);
router.get('/logs/anomalies', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH', 'ADMIN_CMS'), attendanceController.getAnomalyLogs);
router.get('/employees', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH', 'ADMIN_CMS'), attendanceController.getAllEmployees);

module.exports = router;
