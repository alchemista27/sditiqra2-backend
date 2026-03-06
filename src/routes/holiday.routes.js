// src/routes/holiday.routes.js
const express = require('express');
const router = express.Router();
const holidayController = require('../controllers/holiday.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// ─── Semua user bisa lihat hari libur ─────────────────────────
router.get('/', holidayController.getAll);
router.get('/check/:date', holidayController.checkDate);

// ─── Admin only ──────────────────────────────────────────────
router.post('/', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH'), holidayController.create);
router.put('/:id', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH'), holidayController.update);
router.delete('/:id', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH'), holidayController.remove);
router.post('/seed-national/:year', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH'), holidayController.seedNational);

module.exports = router;
