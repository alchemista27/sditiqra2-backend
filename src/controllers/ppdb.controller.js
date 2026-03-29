// src/controllers/ppdb.controller.js
// Controller untuk operasi PPDB dari sisi orang tua (portal)
// Semua route menggunakan middleware authenticateParent (req.parent)

const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');

// ─── Helper: Generate nomor pendaftaran ──────────────────────
const generateRegistrationNo = () => {
  const year = new Date().getFullYear().toString().substring(2);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PPDB-${year}-${random}`;
};

// ─── Helper: Cek apakah tahap ini diizinkan berdasar status ──
const STATUS_ORDER = [
  'PENDING_PAYMENT',
  'PAYMENT_UPLOADED',
  'PAYMENT_VERIFIED',
  'FORM_SUBMITTED',
  'ADMIN_REVIEW',
  'ADMIN_PASSED',
  'CLINIC_LETTER_UPLOADED',
  'OBSERVATION_SCHEDULED',
  'OBSERVATION_DONE',
  'ACCEPTED',
  'REJECTED',
];


// ═══════════════════════════════════════════════════════════════
// REGISTRASI & DASHBOARD ORANG TUA
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/ppdb/start
 * Inisiasi pendaftaran — auto-create registration baru untuk orang tua
 * yang sudah login tapi belum punya registrasi aktif di tahun ajaran ini.
 */
exports.startRegistration = async (req, res) => {
  try {
    const parentId = req.parent.id;

    // Cek tahun ajaran aktif
    const activeYear = await prisma.academicYear.findFirst({
      where: { isActive: true },
    });
    if (!activeYear) {
      return errorResponse(res, 'Pendaftaran saat ini belum dibuka. Tidak ada tahun ajaran aktif.', 400);
    }

    // Cek apakah sudah ada registrasi di tahun ajaran ini
    const existing = await prisma.registration.findFirst({
      where: { parentId, academicYearId: activeYear.id },
    });
    if (existing) {
      return successResponse(res, existing, 'Pendaftaran Anda sudah ada.');
    }

    // Cek kuota
    const count = await prisma.registration.count({
      where: {
        academicYearId: activeYear.id,
        status: { notIn: ['REJECTED'] },
      },
    });
    if (activeYear.quota > 0 && count >= activeYear.quota) {
      return errorResponse(res, 'Mohon maaf, kuota pendaftaran tahun ajaran ini telah penuh.', 400);
    }

    // Buat registrasi baru
    let registrationNo;
    let attempts = 0;
    while (attempts < 5) {
      registrationNo = generateRegistrationNo();
      const duplicate = await prisma.registration.findUnique({ where: { registrationNo } });
      if (!duplicate) break;
      attempts++;
    }

    const registration = await prisma.registration.create({
      data: {
        registrationNo,
        parentId,
        academicYearId: activeYear.id,
        status: 'PENDING_PAYMENT',
      },
    });

    return successResponse(res, registration, 'Pendaftaran berhasil dimulai.', 201);
  } catch (err) {
    console.error('[PPDB/Start]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * GET /api/ppdb/my-registration
 * Orang tua ambil data registrasi aktif miliknya (tahun ajaran aktif).
 */
exports.getMyRegistration = async (req, res) => {
  try {
    const parentId = req.parent.id;

    const activeYear = await prisma.academicYear.findFirst({
      where: { isActive: true },
    });

    const registration = await prisma.registration.findFirst({
      where: {
        parentId,
        ...(activeYear ? { academicYearId: activeYear.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        academicYear: { select: { name: true, registrationFee: true } },
        observationSlot: {
          select: { date: true, startTime: true, endTime: true, note: true },
        },
        classroom: { select: { name: true, homeroomTeacher: true } },
      },
    });

    if (!registration) {
      return successResponse(res, null, 'Belum ada pendaftaran.');
    }

    return successResponse(res, registration, 'Data pendaftaran berhasil diambil.');
  } catch (err) {
    console.error('[PPDB/GetMyRegistration]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};


// ═══════════════════════════════════════════════════════════════
// TAHAP 1: PEMBAYARAN
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/ppdb/payment/upload
 * Orang tua upload bukti transfer pembayaran pendaftaran.
 * File diupload via Multer (req.file) ke Cloudinary.
 */
exports.uploadPayment = async (req, res) => {
  try {
    const parentId = req.parent.id;
    const { note, bankName, senderName, amount } = req.body;

    const registration = await prisma.registration.findFirst({
      where: {
        parentId,
        status: { in: ['PENDING_PAYMENT', 'PAYMENT_UPLOADED'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!registration) {
      return errorResponse(res, 'Tidak ditemukan pendaftaran yang menunggu pembayaran.', 404);
    }

    if (!req.file) {
      return errorResponse(res, 'File bukti transfer wajib diupload.', 400);
    }

    const paymentProofUrl = req.file.path || req.file.filename;

    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: {
        paymentProof: paymentProofUrl,
        paymentNote: note || null,
        status: 'PAYMENT_UPLOADED',
      },
    });

    return successResponse(res, updated, 'Bukti transfer berhasil diupload. Menunggu verifikasi admin.');
  } catch (err) {
    console.error('[PPDB/UploadPayment]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

// ═══════════════════════════════════════════════════════════════
// TAHAP 2: FORMULIR BIODATA
// ═══════════════════════════════════════════════════════════════

/**
 * PUT /api/ppdb/form/student
 * Simpan / update biodata calon siswa.
 * Hanya bisa diakses jika status PAYMENT_VERIFIED ke atas.
 */
exports.saveStudentForm = async (req, res) => {
  try {
    const parentId = req.parent.id;

    const registration = await prisma.registration.findFirst({
      where: { parentId, status: { notIn: ['PENDING_PAYMENT', 'PAYMENT_UPLOADED', 'REJECTED'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!registration) {
      return errorResponse(res, 'Formulir belum dapat diisi. Pastikan pembayaran telah diverifikasi.', 403);
    }

    if (['FORM_SUBMITTED', 'ADMIN_REVIEW', 'ADMIN_PASSED', 'CLINIC_LETTER_UPLOADED',
         'OBSERVATION_SCHEDULED', 'OBSERVATION_DONE', 'ACCEPTED'].includes(registration.status)) {
      return errorResponse(res, 'Formulir sudah disubmit dan tidak dapat diubah.', 400);
    }

    const {
      studentName, nickName, gender, birthPlace, birthDate,
      nisn, religion, address, transport, siblingCount,
      hobby, aspiration, hasSpecialNeeds, specialNeedsDesc,
    } = req.body;

    if (!studentName || !gender || !birthPlace || !birthDate || !religion || !address) {
      return errorResponse(res, 'Nama, jenis kelamin, tempat/tgl lahir, agama, dan alamat wajib diisi.', 400);
    }

    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: {
        studentName,
        nickName: nickName || null,
        gender,
        birthPlace,
        birthDate: birthDate ? new Date(birthDate) : null,
        nisn: nisn || null,
        religion,
        address,
        transport: transport || null,
        siblingCount: siblingCount !== undefined ? Number(siblingCount) : null,
        hobby: hobby || null,
        aspiration: aspiration || null,
        hasSpecialNeeds: Boolean(hasSpecialNeeds),
        specialNeedsDesc: hasSpecialNeeds ? (specialNeedsDesc || null) : null,
      },
    });

    return successResponse(res, updated, 'Biodata siswa berhasil disimpan.');
  } catch (err) {
    console.error('[PPDB/SaveStudentForm]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * PUT /api/ppdb/form/parent
 * Simpan / update biodata orang tua / wali.
 */
exports.saveParentForm = async (req, res) => {
  try {
    const parentId = req.parent.id;

    const registration = await prisma.registration.findFirst({
      where: { parentId, status: { notIn: ['PENDING_PAYMENT', 'PAYMENT_UPLOADED', 'REJECTED'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!registration) {
      return errorResponse(res, 'Formulir belum dapat diisi. Pastikan pembayaran telah diverifikasi.', 403);
    }

    if (['FORM_SUBMITTED', 'ADMIN_REVIEW', 'ADMIN_PASSED', 'CLINIC_LETTER_UPLOADED',
         'OBSERVATION_SCHEDULED', 'OBSERVATION_DONE', 'ACCEPTED'].includes(registration.status)) {
      return errorResponse(res, 'Formulir sudah disubmit dan tidak dapat diubah.', 400);
    }

    const {
      fatherName, fatherNik, fatherJob, fatherIncome, fatherPhone, fatherAddress,
      motherName, motherNik, motherJob, motherIncome, motherPhone, motherAddress,
      guardianName, guardianNik, guardianJob, guardianIncome, guardianPhone, guardianRelation,
    } = req.body;

    if (!fatherName || !fatherNik || !fatherJob || !motherName || !motherNik || !motherJob) {
      return errorResponse(res, 'Nama, NIK, dan pekerjaan ayah serta ibu wajib diisi.', 400);
    }

    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: {
        fatherName, fatherNik, fatherJob,
        fatherIncome: fatherIncome || null,
        fatherPhone: fatherPhone || null,
        fatherAddress: fatherAddress || null,
        motherName, motherNik, motherJob,
        motherIncome: motherIncome || null,
        motherPhone: motherPhone || null,
        motherAddress: motherAddress || null,
        guardianName: guardianName || null,
        guardianNik: guardianNik || null,
        guardianJob: guardianJob || null,
        guardianIncome: guardianIncome || null,
        guardianPhone: guardianPhone || null,
        guardianRelation: guardianRelation || null,
      },
    });

    return successResponse(res, updated, 'Biodata orang tua/wali berhasil disimpan.');
  } catch (err) {
    console.error('[PPDB/SaveParentForm]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * POST /api/ppdb/form/documents
 * Upload berkas-berkas yang diperlukan (6 dokumen).
 * Menggunakan multer fields.
 */
exports.uploadDocuments = async (req, res) => {
  try {
    const parentId = req.parent.id;

    const registration = await prisma.registration.findFirst({
      where: { parentId, status: { notIn: ['PENDING_PAYMENT', 'PAYMENT_UPLOADED', 'REJECTED'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!registration) {
      return errorResponse(res, 'Tidak dapat mengupload berkas. Pastikan pembayaran sudah diverifikasi.', 403);
    }

    if (['FORM_SUBMITTED', 'ADMIN_REVIEW', 'ADMIN_PASSED', 'CLINIC_LETTER_UPLOADED',
         'OBSERVATION_SCHEDULED', 'OBSERVATION_DONE', 'ACCEPTED'].includes(registration.status)) {
      return errorResponse(res, 'Formulir sudah disubmit, berkas tidak dapat diubah.', 400);
    }

    const files = req.files || {};
    const getUrl = (fieldname) => {
      if (!files[fieldname] || !files[fieldname][0]) return undefined;
      return files[fieldname][0].path || files[fieldname][0].filename;
    };

    const updateData = {};
    if (getUrl('docPhoto'))         updateData.docPhoto = getUrl('docPhoto');
    if (getUrl('docTkCert'))        updateData.docTkCert = getUrl('docTkCert');
    if (getUrl('docBirthCert'))     updateData.docBirthCert = getUrl('docBirthCert');
    if (getUrl('docKartuKeluarga')) updateData.docKartuKeluarga = getUrl('docKartuKeluarga');
    if (getUrl('docKtpFather'))     updateData.docKtpFather = getUrl('docKtpFather');
    if (getUrl('docKtpMother'))     updateData.docKtpMother = getUrl('docKtpMother');

    if (Object.keys(updateData).length === 0) {
      return errorResponse(res, 'Tidak ada file yang diupload.', 400);
    }

    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: updateData,
    });

    return successResponse(res, updated, 'Berkas berhasil diupload.');
  } catch (err) {
    console.error('[PPDB/UploadDocuments]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * POST /api/ppdb/form/submit
 * Final submit formulir — validasi kelengkapan lalu ubah status ke FORM_SUBMITTED.
 */
exports.submitForm = async (req, res) => {
  try {
    const parentId = req.parent.id;

    const registration = await prisma.registration.findFirst({
      where: { parentId, status: 'PAYMENT_VERIFIED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!registration) {
      return errorResponse(res, 'Tidak dapat submit. Status pendaftaran tidak memenuhi syarat.', 400);
    }

    // Validasi kelengkapan biodata siswa
    const studentFields = ['studentName', 'gender', 'birthPlace', 'birthDate', 'religion', 'address'];
    const missingStudent = studentFields.filter(f => !registration[f]);
    if (missingStudent.length > 0) {
      return errorResponse(res, `Biodata siswa belum lengkap: ${missingStudent.join(', ')}`, 400);
    }

    // Validasi kelengkapan biodata orang tua
    const parentFields = ['fatherName', 'fatherNik', 'fatherJob', 'motherName', 'motherNik', 'motherJob'];
    const missingParent = parentFields.filter(f => !registration[f]);
    if (missingParent.length > 0) {
      return errorResponse(res, `Biodata orang tua belum lengkap: ${missingParent.join(', ')}`, 400);
    }

    // Validasi kelengkapan semua berkas
    const docFields = ['docPhoto', 'docTkCert', 'docBirthCert', 'docKartuKeluarga', 'docKtpFather', 'docKtpMother'];
    const missingDocs = docFields.filter(f => !registration[f]);
    if (missingDocs.length > 0) {
      return errorResponse(res, `Berkas belum lengkap: ${missingDocs.join(', ')}`, 400);
    }

    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: {
        status: 'FORM_SUBMITTED',
        formSubmittedAt: new Date(),
      },
    });

    return successResponse(res, updated, 'Formulir berhasil disubmit! Silakan unduh dan cetak surat pengantar klinik.');
  } catch (err) {
    console.error('[PPDB/SubmitForm]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};


// ═══════════════════════════════════════════════════════════════
// TAHAP 3: UPLOAD SURAT KETERANGAN KLINIK IMC
// ═══════════════════════════════════════════════════════════════

/**
 * POST /api/ppdb/clinic-cert/upload
 * Orang tua upload surat keterangan kesehatan dari klinik IMC.
 * Surat klinik diupload sebelum seleksi administrasi (status FORM_SUBMITTED).
 */
exports.uploadClinicCert = async (req, res) => {
  try {
    const parentId = req.parent.id;

    const registration = await prisma.registration.findFirst({
      // Ubahan: Dulu ADMIN_PASSED, sekarang FORM_SUBMITTED
      where: { parentId, status: 'FORM_SUBMITTED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!registration) {
      return errorResponse(res, 'Tidak dapat upload surat klinik. Status pendaftaran tidak memenuhi syarat.', 403);
    }

    if (!req.file) {
      return errorResponse(res, 'File surat keterangan klinik wajib diupload.', 400);
    }

    const certUrl = req.file.path || req.file.filename;

    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: {
        docClinicCert: certUrl,
        clinicCertUploadedAt: new Date(),
        status: 'CLINIC_LETTER_UPLOADED',
      },
    });

    return successResponse(res, updated, 'Surat keterangan klinik berhasil diupload.');
  } catch (err) {
    console.error('[PPDB/UploadClinicCert]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};


// ═══════════════════════════════════════════════════════════════
// TAHAP 4: PENJADWALAN OBSERVASI
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/ppdb/observation-slots
 * List jadwal observasi yang tersedia (sisa kuota > 0).
 */
exports.getAvailableSlots = async (req, res) => {
  try {
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!activeYear) return successResponse(res, [], 'Tidak ada tahun ajaran aktif.');

    const slots = await prisma.observationSlot.findMany({
      where: {
        academicYearId: activeYear.id,
        isActive: true,
        date: { gte: new Date() }, // Hanya tampilkan slot yang belum lewat
      },
      include: {
        _count: { select: { registrations: true } },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    // Hanya tampilkan yang masih ada kuota
    const available = slots
      .filter(s => s._count.registrations < s.quota)
      .map(s => ({
        ...s,
        registered: s._count.registrations,
        remaining: s.quota - s._count.registrations,
        _count: undefined,
      }));

    return successResponse(res, available, 'Jadwal observasi tersedia.');
  } catch (err) {
    console.error('[PPDB/GetAvailableSlots]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * POST /api/ppdb/observation-slots/book
 * Orang tua pilih / booking jadwal observasi.
 * Hanya bisa jika status = ADMIN_PASSED. (Setelah lolos seleksi dokumen+klinik)
 */
exports.bookObservationSlot = async (req, res) => {
  try {
    const parentId = req.parent.id;
    const { slotId } = req.body;

    if (!slotId) return errorResponse(res, 'ID jadwal observasi wajib disertakan.', 400);

    const registration = await prisma.registration.findFirst({
      where: { parentId, status: 'ADMIN_PASSED' },
      orderBy: { createdAt: 'desc' },
    });

    if (!registration) {
      return errorResponse(res, 'Belum dapat memilih jadwal. Upload surat keterangan klinik terlebih dahulu.', 403);
    }

    // Cek slot
    const slot = await prisma.observationSlot.findUnique({
      where: { id: slotId },
      include: { _count: { select: { registrations: true } } },
    });

    if (!slot || !slot.isActive) {
      return errorResponse(res, 'Jadwal tidak ditemukan atau sudah tidak aktif.', 404);
    }

    if (slot._count.registrations >= slot.quota) {
      return errorResponse(res, 'Jadwal ini sudah penuh. Silakan pilih jadwal lain.', 400);
    }

    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: {
        observationSlotId: slotId,
        status: 'OBSERVATION_SCHEDULED',
      },
      include: {
        observationSlot: { select: { date: true, startTime: true, endTime: true, note: true } },
      },
    });

    return successResponse(res, updated, 'Jadwal observasi berhasil dipilih.');
  } catch (err) {
    console.error('[PPDB/BookObservationSlot]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};


// ═══════════════════════════════════════════════════════════════
// HASIL AKHIR
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/ppdb/my-result
 * Orang tua lihat hasil akhir pendaftaran (status + kelas jika diterima).
 */
exports.getMyResult = async (req, res) => {
  try {
    const parentId = req.parent.id;

    const registration = await prisma.registration.findFirst({
      where: { parentId },
      orderBy: { createdAt: 'desc' },
      include: {
        academicYear: { select: { name: true } },
        observationSlot: { select: { date: true, startTime: true, endTime: true } },
        classroom: { select: { name: true, grade: true, homeroomTeacher: true } },
      },
    });

    if (!registration) {
      return successResponse(res, null, 'Belum ada pendaftaran.');
    }

    return successResponse(res, registration, 'Hasil pendaftaran berhasil diambil.');
  } catch (err) {
    console.error('[PPDB/GetMyResult]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};
