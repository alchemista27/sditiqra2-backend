// src/routes/ppdb.routes.js
const express = require('express');
const router = express.Router();
const ppdbController = require('../controllers/ppdb.controller');
const ayController = require('../controllers/academic-year.controller');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

// ─── TAHUN AJARAN (Academic Year) ───────────────────
// Publik: Ambil tahun ajaran aktif untuk form pendaftaran
router.get('/academic-years/active', ayController.getActive);

// Admin Only
router.get('/academic-years', authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB'), ayController.getAll);
router.post('/academic-years', authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB'), ayController.create);
router.put('/academic-years/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB'), ayController.update);
router.put('/academic-years/:id/active', authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB'), ayController.setActive);
router.delete('/academic-years/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB'), ayController.remove);

// ─── PENDAFTARAN PPDB ────────────────────────────────

// Konfigurasi Multer untuk Menerima Berkas PPDB
const ppdbUploads = upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'docBirthCert', maxCount: 1 },
  { name: 'docKartuKeluarga', maxCount: 1 },
  { name: 'docIjazahTK', maxCount: 1 }
]);

// Publik/Orang Tua
// Mendaftar akun dan mengirim formulir pendaftaran
router.post('/register', ppdbUploads, ppdbController.register); // Harus disesuaikan dengan auth pendaftar di frontend

// Menarik data pendaftarannya sendiri
// router.get('/my-registrations', protect, authorize('PARENT'), ppdbController.getMyRegistrations);

// Admin Only
router.get('/registrations', authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB', 'KEPALA_SEKOLAH'), ppdbController.getAllRegistrations);
router.get('/registrations/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB', 'KEPALA_SEKOLAH'), ppdbController.getRegistrationDetail);
router.put('/registrations/:id/status', authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB'), ppdbController.updateStatus);

module.exports = router;
