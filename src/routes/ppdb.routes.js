// src/routes/ppdb.routes.js
// Route PPDB — Portal Orang Tua & Admin

const express = require('express');
const router = express.Router();
const ppdbController = require('../controllers/ppdb.controller');
const ppdbAdminController = require('../controllers/ppdb-admin.controller');
const ayController = require('../controllers/academic-year.controller');
const { authenticate, authorize, authenticateParent } = require('../middleware/auth');
const upload = require('../utils/upload');
const prisma = require('../lib/prisma');
const { generateClinicLetter } = require('../utils/generateClinicLetter');
const { errorResponse } = require('../utils/response');

// ─── Konfigurasi Multer untuk upload file PPDB ───────────────

// Single file (bukti transfer, sertifikat klinik)
const singleUpload = upload.single('file');

// Multiple fields untuk berkas pendaftaran
const documentsUpload = upload.fields([
  { name: 'docPhoto',         maxCount: 1 }, // Pasfoto 3x4
  { name: 'docTkCert',        maxCount: 1 }, // Surat keterangan TK/PAUD
  { name: 'docBirthCert',     maxCount: 1 }, // Akte kelahiran
  { name: 'docKartuKeluarga', maxCount: 1 }, // Kartu keluarga
  { name: 'docKtpFather',     maxCount: 1 }, // KTP ayah
  { name: 'docKtpMother',     maxCount: 1 }, // KTP ibu
]);


// ═══════════════════════════════════════════════════════════════
// TAHUN AJARAN (PUBLIK & ADMIN)
// ═══════════════════════════════════════════════════════════════

// Publik: info tahun ajaran aktif untuk landing page PPDB
router.get('/academic-years/active', ayController.getActive);

// Admin: manajemen tahun ajaran
router.get('/academic-years',       authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB'), ayController.getAll);
router.post('/academic-years',      authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB'), ayController.create);
router.put('/academic-years/:id',   authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB'), ayController.update);
router.put('/academic-years/:id/active', authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB'), ayController.setActive);
router.delete('/academic-years/:id', authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB'), ayController.remove);


// ═══════════════════════════════════════════════════════════════
// PORTAL ORANG TUA — Semua route dilindungi authenticateParent
// ═══════════════════════════════════════════════════════════════

// Inisiasi & info pendaftaran
router.post('/start',            authenticateParent, ppdbController.startRegistration);
router.get('/my-registration',   authenticateParent, ppdbController.getMyRegistration);
router.get('/my-result',         authenticateParent, ppdbController.getMyResult);

// Tahap 1: Pembayaran
router.post('/payment/upload',   authenticateParent, singleUpload, ppdbController.uploadPayment);

// Tahap 2: Formulir biodata
router.put('/form/student',      authenticateParent, ppdbController.saveStudentForm);
router.put('/form/parent-info',  authenticateParent, ppdbController.saveParentForm);
router.post('/form/documents',   authenticateParent, documentsUpload, ppdbController.uploadDocuments);
router.post('/form/submit',      authenticateParent, ppdbController.submitForm);

// Tahap 3: Surat pengantar klinik (generate PDF on-demand)
router.get('/referral-letter', authenticateParent, async (req, res) => {
  try {
    const parentId = req.parent.id;

    const registration = await prisma.registration.findFirst({
      where: {
        parentId,
        status: {
          in: ['ADMIN_PASSED', 'CLINIC_LETTER_UPLOADED', 'OBSERVATION_SCHEDULED', 'OBSERVATION_DONE', 'ACCEPTED'],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: { parent: { select: { name: true } } },
    });

    if (!registration) {
      return errorResponse(res, 'Surat pengantar belum tersedia. Pastikan Anda telah lulus seleksi administrasi.', 403);
    }

    // Generate nomor surat jika belum ada
    let referralNo = registration.clinicReferralNo;
    if (!referralNo) {
      const year = new Date().getFullYear();
      const count = await prisma.registration.count({
        where: {
          clinicReferralNo: { not: null },
          createdAt: { gte: new Date(`${year}-01-01`) },
        },
      });
      referralNo = `SKP/PPDB/${year}/${String(count + 1).padStart(4, '0')}`;

      // Simpan nomor surat ke database
      await prisma.registration.update({
        where: { id: registration.id },
        data: { clinicReferralNo: referralNo },
      });
    }

    const pdfBuffer = await generateClinicLetter(registration, referralNo);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="surat-pengantar-klinik-${registration.registrationNo}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[PPDB/ReferralLetter]', err);
    return errorResponse(res, 'Gagal generate surat pengantar.', 500);
  }
});

// Upload surat keterangan dari klinik IMC
router.post('/clinic-cert/upload', authenticateParent, singleUpload, ppdbController.uploadClinicCert);

// Tahap 4: Observasi
router.get('/observation-slots',         authenticateParent, ppdbController.getAvailableSlots);
router.post('/observation-slots/book',   authenticateParent, ppdbController.bookObservationSlot);


// ═══════════════════════════════════════════════════════════════
// ADMIN PPDB — Semua route dilindungi authenticate + authorize
// ═══════════════════════════════════════════════════════════════

const adminAuth = [authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB')];
const adminViewAuth = [authenticate, authorize('SUPER_ADMIN', 'ADMIN_PPDB', 'KEPALA_SEKOLAH')];

// Dashboard statistik
router.get('/admin/stats', ...adminViewAuth, ppdbAdminController.getStats);

// Manajemen registrasi
router.get('/admin/registrations',             ...adminViewAuth, ppdbAdminController.getAllRegistrations);
router.get('/admin/registrations/:id',         ...adminViewAuth, ppdbAdminController.getRegistrationDetail);
router.put('/admin/registrations/:id/review',  ...adminAuth,     ppdbAdminController.reviewRegistration);
router.put('/admin/registrations/:id/observation', ...adminAuth, ppdbAdminController.recordObservationResult);
router.put('/admin/registrations/:id/assign-class', ...adminAuth, ppdbAdminController.assignClass);

// Verifikasi pembayaran
router.get('/admin/payments',           ...adminAuth, ppdbAdminController.getPendingPayments);
router.put('/admin/payments/:id/verify', ...adminAuth, ppdbAdminController.verifyPayment);
router.put('/admin/payments/:id/reject', ...adminAuth, ppdbAdminController.rejectPayment);

// Manajemen slot observasi
router.get('/admin/observation-slots',         ...adminAuth, ppdbAdminController.getObservationSlots);
router.post('/admin/observation-slots',        ...adminAuth, ppdbAdminController.createObservationSlot);
router.put('/admin/observation-slots/:id',     ...adminAuth, ppdbAdminController.updateObservationSlot);
router.delete('/admin/observation-slots/:id',  ...adminAuth, ppdbAdminController.deleteObservationSlot);

// Manajemen kelas paralel
router.get('/admin/classrooms',         ...adminAuth, ppdbAdminController.getClassrooms);
router.post('/admin/classrooms',        ...adminAuth, ppdbAdminController.createClassroom);
router.put('/admin/classrooms/:id',     ...adminAuth, ppdbAdminController.updateClassroom);
router.delete('/admin/classrooms/:id',  ...adminAuth, ppdbAdminController.deleteClassroom);

module.exports = router;
