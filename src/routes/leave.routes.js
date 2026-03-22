// src/routes/leave.routes.js
const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leave.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// ─── KARYAWAN ────────────────────────────────────────────────
router.post('/', leaveController.create);
router.get('/my-requests', leaveController.getMyRequests);

// ─── ADMIN ───────────────────────────────────────────────────
router.get('/', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH', 'ADMIN_CMS'), leaveController.getAll);
router.get('/:id', leaveController.getById);
router.put('/:id/approve', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH'), leaveController.approve);
router.put('/:id/reject', authorize('SUPER_ADMIN', 'KEPALA_SEKOLAH'), leaveController.reject);

module.exports = router;
