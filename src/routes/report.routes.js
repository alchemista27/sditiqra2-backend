// src/routes/report.routes.js
const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH', 'ADMIN_CMS'));

// ─── Laporan Excel ───────────────────────────────────────────
router.get('/attendance/excel', reportController.generateAttendanceExcel);

// ─── JSON Summary (untuk dashboard) ──────────────────────────
router.get('/attendance/summary', reportController.getAttendanceSummary);

module.exports = router;
