// src/controllers/ppdb-admin.controller.js
// Controller untuk operasi PPDB dari sisi admin
// Semua route menggunakan middleware authenticate + authorize(ADMIN_PPDB / SUPER_ADMIN)

const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');

// ═══════════════════════════════════════════════════════════════
// DASHBOARD & STATISTIK
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/ppdb/stats
 * Statistik ringkasan PPDB untuk tahun ajaran aktif.
 */
exports.getStats = async (req, res) => {
  try {
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
    if (!activeYear) return successResponse(res, null, 'Tidak ada tahun ajaran aktif.');

    const statuses = [
      'PENDING_PAYMENT', 'PAYMENT_UPLOADED', 'PAYMENT_VERIFIED',
      'FORM_SUBMITTED', 'ADMIN_REVIEW', 'ADMIN_PASSED',
      'CLINIC_LETTER_UPLOADED', 'OBSERVATION_SCHEDULED',
      'OBSERVATION_DONE', 'ACCEPTED', 'REJECTED',
    ];

    const [counts, recentRegistrations] = await Promise.all([
      Promise.all(statuses.map(s => prisma.registration.count({ where: { academicYearId: activeYear.id, status: s } }))),
      prisma.registration.findMany({
        where: { academicYearId: activeYear.id },
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { parent: { select: { name: true, phone: true } }, academicYear: { select: { name: true } } },
      }),
    ]);

    const byStatus = {};
    statuses.forEach((s, i) => { byStatus[s] = counts[i]; });
    const total = counts.reduce((a, b) => a + b, 0);

    return successResponse(res, {
      total,
      pendingPayment: (byStatus.PENDING_PAYMENT || 0) + (byStatus.PAYMENT_UPLOADED || 0),
      paymentUploaded: byStatus.PAYMENT_UPLOADED || 0,
      paymentVerified: byStatus.PAYMENT_VERIFIED || 0,
      formSubmitted: byStatus.FORM_SUBMITTED || 0,
      adminPassed: byStatus.ADMIN_PASSED || 0,
      clinicUploaded: byStatus.CLINIC_LETTER_UPLOADED || 0,
      observationScheduled: byStatus.OBSERVATION_SCHEDULED || 0,
      accepted: byStatus.ACCEPTED || 0,
      rejected: byStatus.REJECTED || 0,
      byStatus,
      academicYear: activeYear.name,
      recentRegistrations,
    }, 'Statistik PPDB berhasil diambil.');
  } catch (err) {
    console.error('[PPDB-Admin/GetStats]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};


// ═══════════════════════════════════════════════════════════════
// MANAJEMEN REGISTRASI
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/ppdb/registrations
 * List semua registrasi (dengan filter status dan pencarian).
 */
exports.getAllRegistrations = async (req, res) => {
  try {
    const { status, academicYearId, search, page = 1, limit = 20 } = req.query;

    const where = {};
    if (status) where.status = status;
    if (academicYearId) where.academicYearId = academicYearId;
    if (search) {
      where.OR = [
        { studentName: { contains: search, mode: 'insensitive' } },
        { registrationNo: { contains: search, mode: 'insensitive' } },
        { parent: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          parent: { select: { name: true, phone: true, email: true } },
          academicYear: { select: { name: true } },
          observationSlot: { select: { date: true, startTime: true } },
          classroom: { select: { name: true } },
        },
      }),
      prisma.registration.count({ where }),
    ]);

    return successResponse(res, {
      data: registrations,
      pagination: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
    }, 'Data registrasi berhasil diambil.');
  } catch (err) {
    console.error('[PPDB-Admin/GetAll]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * GET /api/admin/ppdb/registrations/:id
 * Detail lengkap satu registrasi termasuk semua dokumen.
 */
exports.getRegistrationDetail = async (req, res) => {
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: req.params.id },
      include: {
        parent: true,
        academicYear: true,
        observationSlot: true,
        classroom: true,
      },
    });

    if (!registration) return errorResponse(res, 'Pendaftaran tidak ditemukan.', 404);

    return successResponse(res, registration, 'Detail pendaftaran berhasil diambil.');
  } catch (err) {
    console.error('[PPDB-Admin/GetDetail]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};


// ═══════════════════════════════════════════════════════════════
// VERIFIKASI PEMBAYARAN
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/ppdb/payments
 * List pendaftaran yang menunggu verifikasi pembayaran.
 */
exports.getPendingPayments = async (req, res) => {
  try {
    const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });

    const registrations = await prisma.registration.findMany({
      where: {
        status: 'PAYMENT_UPLOADED',
        ...(activeYear ? { academicYearId: activeYear.id } : {}),
      },
      orderBy: { updatedAt: 'asc' }, // Yang paling lama upload duluan
      include: {
        parent: { select: { name: true, phone: true, email: true } },
        academicYear: { select: { name: true } },
      },
    });

    return successResponse(res, registrations, 'Daftar pembayaran menunggu verifikasi.');
  } catch (err) {
    console.error('[PPDB-Admin/GetPendingPayments]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * PUT /api/admin/ppdb/payments/:id/verify
 * Admin approve pembayaran → aktifkan akses formulir.
 */
exports.verifyPayment = async (req, res) => {
  try {
    const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
    if (!registration) return errorResponse(res, 'Pendaftaran tidak ditemukan.', 404);
    if (registration.status !== 'PAYMENT_UPLOADED') {
      return errorResponse(res, 'Status pendaftaran tidak memenuhi syarat untuk verifikasi pembayaran.', 400);
    }

    const updated = await prisma.registration.update({
      where: { id: req.params.id },
      data: {
        status: 'PAYMENT_VERIFIED',
        paymentVerifiedAt: new Date(),
        paymentVerifiedBy: req.user.id,
      },
    });

    return successResponse(res, updated, 'Pembayaran berhasil diverifikasi. Orang tua dapat mengisi formulir.');
  } catch (err) {
    console.error('[PPDB-Admin/VerifyPayment]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * PUT /api/admin/ppdb/payments/:id/reject
 * Admin tolak bukti pembayaran (minta upload ulang).
 */
exports.rejectPayment = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return errorResponse(res, 'Alasan penolakan wajib diisi.', 400);

    const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
    if (!registration) return errorResponse(res, 'Pendaftaran tidak ditemukan.', 404);
    if (registration.status !== 'PAYMENT_UPLOADED') {
      return errorResponse(res, 'Status pendaftaran tidak memenuhi syarat.', 400);
    }

    const updated = await prisma.registration.update({
      where: { id: req.params.id },
      data: {
        // Kembalikan ke PENDING_PAYMENT agar orang tua bisa upload ulang
        status: 'PENDING_PAYMENT',
        paymentProof: null,
        paymentNote: `[DITOLAK] ${reason}`, // Simpan alasan di paymentNote
      },
    });

    return successResponse(res, updated, 'Bukti pembayaran ditolak. Orang tua diminta upload ulang.');
  } catch (err) {
    console.error('[PPDB-Admin/RejectPayment]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};


// ═══════════════════════════════════════════════════════════════
// SELEKSI ADMINISTRASI
// ═══════════════════════════════════════════════════════════════

/**
 * PUT /api/admin/ppdb/registrations/:id/review
 * Admin review formulir → lulus atau tolak seleksi administrasi.
 */
exports.reviewRegistration = async (req, res) => {
  try {
    const { result, note } = req.body;

    if (!result || !['ADMIN_PASSED', 'REJECTED'].includes(result)) {
      return errorResponse(res, 'Result harus berisi ADMIN_PASSED atau REJECTED.', 400);
    }
    if (result === 'REJECTED' && !note) {
      return errorResponse(res, 'Alasan penolakan wajib diisi jika ditolak.', 400);
    }

    const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
    if (!registration) return errorResponse(res, 'Pendaftaran tidak ditemukan.', 404);

    const allowedStatuses = ['CLINIC_LETTER_UPLOADED', 'ADMIN_REVIEW'];
    if (!allowedStatuses.includes(registration.status)) {
      return errorResponse(res, 'Status pendaftaran tidak memenuhi syarat untuk seleksi administrasi (Siswa harus mengunggah surat klinik terlebih dahulu).', 400);
    }

    const updateData = {
      status: result,
      adminNote: note || null,
      adminReviewedAt: new Date(),
      adminReviewedBy: req.user.id,
    };

    if (result === 'REJECTED') {
      updateData.rejectReason = note;
      updateData.rejectedAt = new Date();
      updateData.rejectedBy = req.user.id;
    }

    const updated = await prisma.registration.update({
      where: { id: req.params.id },
      data: updateData,
      include: { parent: { select: { name: true, email: true } } },
    });

    const message = result === 'ADMIN_PASSED'
      ? 'Pendaftar dinyatakan lulus seleksi administrasi.'
      : 'Pendaftar dinyatakan tidak lulus seleksi administrasi.';

    return successResponse(res, updated, message);
  } catch (err) {
    console.error('[PPDB-Admin/ReviewRegistration]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};


// ═══════════════════════════════════════════════════════════════
// MANAJEMEN SLOT OBSERVASI
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/ppdb/observation-slots
 * List semua slot observasi untuk tahun ajaran aktif, beserta penggunaan kuota.
 */
exports.getObservationSlots = async (req, res) => {
  try {
    const { academicYearId } = req.query;
    const activeYear = academicYearId
      ? { id: academicYearId }
      : await prisma.academicYear.findFirst({ where: { isActive: true } });

    const slots = await prisma.observationSlot.findMany({
      where: { academicYearId: activeYear?.id },
      include: {
        _count: { select: { registrations: true } },
        registrations: {
          select: { id: true, registrationNo: true, studentName: true, parent: { select: { name: true } } },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    const result = slots.map(s => ({
      ...s,
      registered: s._count.registrations,
      remaining: s.quota - s._count.registrations,
    }));

    return successResponse(res, result, 'Data jadwal observasi berhasil diambil.');
  } catch (err) {
    console.error('[PPDB-Admin/GetObservationSlots]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * POST /api/admin/ppdb/observation-slots
 * Buat slot jadwal observasi baru.
 */
exports.createObservationSlot = async (req, res) => {
  try {
    const { date, startTime, endTime, quota, note, academicYearId } = req.body;

    if (!date || !startTime || !endTime || !quota) {
      return errorResponse(res, 'Tanggal, jam mulai, jam selesai, dan kuota wajib diisi.', 400);
    }

    // Gunakan academicYearId dari body, atau cari yang aktif
    let yearId = academicYearId;
    if (!yearId) {
      const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
      if (!activeYear) return errorResponse(res, 'Tidak ada tahun ajaran aktif.', 400);
      yearId = activeYear.id;
    }

    const slot = await prisma.observationSlot.create({
      data: {
        date: new Date(date),
        startTime,
        endTime,
        quota: Number(quota),
        note: note || null,
        academicYearId: yearId,
      },
    });

    return successResponse(res, slot, 'Jadwal observasi berhasil dibuat.', 201);
  } catch (err) {
    console.error('[PPDB-Admin/CreateObservationSlot]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * PUT /api/admin/ppdb/observation-slots/:id
 * Update slot jadwal observasi.
 */
exports.updateObservationSlot = async (req, res) => {
  try {
    const { date, startTime, endTime, quota, note, isActive } = req.body;

    const slot = await prisma.observationSlot.update({
      where: { id: req.params.id },
      data: {
        ...(date ? { date: new Date(date) } : {}),
        ...(startTime ? { startTime } : {}),
        ...(endTime ? { endTime } : {}),
        ...(quota !== undefined ? { quota: Number(quota) } : {}),
        ...(note !== undefined ? { note } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    return successResponse(res, slot, 'Jadwal observasi berhasil diperbarui.');
  } catch (err) {
    console.error('[PPDB-Admin/UpdateObservationSlot]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * DELETE /api/admin/ppdb/observation-slots/:id
 * Hapus slot observasi (hanya jika belum ada pendaftar yang booking).
 */
exports.deleteObservationSlot = async (req, res) => {
  try {
    const slot = await prisma.observationSlot.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { registrations: true } } },
    });

    if (!slot) return errorResponse(res, 'Jadwal tidak ditemukan.', 404);
    if (slot._count.registrations > 0) {
      return errorResponse(res, 'Jadwal tidak dapat dihapus karena sudah ada pendaftar yang memilih jadwal ini.', 400);
    }

    await prisma.observationSlot.delete({ where: { id: req.params.id } });
    return successResponse(res, null, 'Jadwal observasi berhasil dihapus.');
  } catch (err) {
    console.error('[PPDB-Admin/DeleteObservationSlot]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * PUT /api/admin/ppdb/registrations/:id/observation
 * Admin catat hasil observasi (PASSED atau FAILED).
 */
exports.recordObservationResult = async (req, res) => {
  try {
    const { result, note } = req.body;

    if (!result || !['PASSED', 'FAILED'].includes(result)) {
      return errorResponse(res, 'Result harus PASSED atau FAILED.', 400);
    }

    const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
    if (!registration) return errorResponse(res, 'Pendaftaran tidak ditemukan.', 404);

    if (!['OBSERVATION_SCHEDULED', 'OBSERVATION_DONE'].includes(registration.status)) {
      return errorResponse(res, 'Status pendaftaran tidak memenuhi syarat untuk pencatatan hasil observasi.', 400);
    }

    const updateData = {
      status: 'OBSERVATION_DONE',
      observationResult: result,
      observationNote: note || null,
      observedAt: new Date(),
    };

    if (result === 'FAILED') {
      updateData.status = 'REJECTED';
      updateData.rejectReason = note || 'Tidak lulus tahap observasi.';
      updateData.rejectedAt = new Date();
      updateData.rejectedBy = req.user.id;
    }

    const updated = await prisma.registration.update({
      where: { id: req.params.id },
      data: updateData,
    });

    return successResponse(res, updated, result === 'PASSED'
      ? 'Hasil observasi dicatat: LULUS. Siswa dapat ditetapkan dan di-assign ke kelas.'
      : 'Hasil observasi dicatat: TIDAK LULUS.'
    );
  } catch (err) {
    console.error('[PPDB-Admin/RecordObservationResult]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};


// ═══════════════════════════════════════════════════════════════
// MANAJEMEN KELAS & PENETAPAN SISWA
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/admin/ppdb/classrooms
 * List semua kelas paralel beserta jumlah siswa yang sudah diassign.
 */
exports.getClassrooms = async (req, res) => {
  try {
    const { academicYearId } = req.query;
    const activeYear = academicYearId
      ? { id: academicYearId }
      : await prisma.academicYear.findFirst({ where: { isActive: true } });

    const classrooms = await prisma.classroom.findMany({
      where: { academicYearId: activeYear?.id },
      include: {
        _count: { select: { registrations: true } },
        registrations: {
          select: { id: true, registrationNo: true, studentName: true, gender: true },
          where: { status: { in: ['ACCEPTED', 'OBSERVATION_DONE'] } },
        },
      },
      orderBy: { name: 'asc' },
    });

    const result = classrooms.map(c => ({
      ...c,
      studentCount: c._count.registrations,
      available: c.maxStudents - c._count.registrations,
    }));

    return successResponse(res, result, 'Data kelas berhasil diambil.');
  } catch (err) {
    console.error('[PPDB-Admin/GetClassrooms]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * POST /api/admin/ppdb/classrooms
 * Buat kelas baru.
 */
exports.createClassroom = async (req, res) => {
  try {
    const { name, grade, maxStudents, homeroomTeacher, academicYearId } = req.body;
    if (!name) return errorResponse(res, 'Nama kelas wajib diisi.', 400);

    let yearId = academicYearId;
    if (!yearId) {
      const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
      if (!activeYear) return errorResponse(res, 'Tidak ada tahun ajaran aktif.', 400);
      yearId = activeYear.id;
    }

    const classroom = await prisma.classroom.create({
      data: {
        name,
        grade: grade ? Number(grade) : 1,
        maxStudents: maxStudents ? Number(maxStudents) : 30,
        homeroomTeacher: homeroomTeacher || null,
        academicYearId: yearId,
      },
    });

    return successResponse(res, classroom, 'Kelas berhasil dibuat.', 201);
  } catch (err) {
    console.error('[PPDB-Admin/CreateClassroom]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * PUT /api/admin/ppdb/classrooms/:id
 * Update data kelas.
 */
exports.updateClassroom = async (req, res) => {
  try {
    const { name, grade, maxStudents, homeroomTeacher } = req.body;

    const classroom = await prisma.classroom.update({
      where: { id: req.params.id },
      data: {
        ...(name ? { name } : {}),
        ...(grade !== undefined ? { grade: Number(grade) } : {}),
        ...(maxStudents !== undefined ? { maxStudents: Number(maxStudents) } : {}),
        ...(homeroomTeacher !== undefined ? { homeroomTeacher } : {}),
      },
    });

    return successResponse(res, classroom, 'Data kelas berhasil diperbarui.');
  } catch (err) {
    console.error('[PPDB-Admin/UpdateClassroom]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * DELETE /api/admin/ppdb/classrooms/:id
 * Hapus kelas (hanya jika belum ada siswa diassign).
 */
exports.deleteClassroom = async (req, res) => {
  try {
    const classroom = await prisma.classroom.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { registrations: true } } },
    });
    if (!classroom) return errorResponse(res, 'Kelas tidak ditemukan.', 404);
    if (classroom._count.registrations > 0) {
      return errorResponse(res, 'Kelas tidak dapat dihapus karena masih ada siswa yang diassign.', 400);
    }

    await prisma.classroom.delete({ where: { id: req.params.id } });
    return successResponse(res, null, 'Kelas berhasil dihapus.');
  } catch (err) {
    console.error('[PPDB-Admin/DeleteClassroom]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};

/**
 * PUT /api/admin/ppdb/registrations/:id/assign-class
 * Admin assign siswa ke kelas tertentu dan set status ACCEPTED.
 */
exports.assignClass = async (req, res) => {
  try {
    const { classroomId } = req.body;
    if (!classroomId) return errorResponse(res, 'ID kelas wajib disertakan.', 400);

    const registration = await prisma.registration.findUnique({ where: { id: req.params.id } });
    if (!registration) return errorResponse(res, 'Pendaftaran tidak ditemukan.', 404);

    if (
      !(registration.status === 'OBSERVATION_DONE' && registration.observationResult === 'PASSED') &&
      registration.status !== 'ACCEPTED'
    ) {
      return errorResponse(res, 'Siswa hanya dapat diassign ke kelas jika lulus tahap observasi atau sudah diterima.', 400);
    }

    // Cek kapasitas kelas
    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      include: { _count: { select: { registrations: true } } },
    });
    if (!classroom) return errorResponse(res, 'Kelas tidak ditemukan.', 404);
    if (classroom._count.registrations >= classroom.maxStudents) {
      return errorResponse(res, `Kelas ${classroom.name} sudah penuh (${classroom.maxStudents} siswa).`, 400);
    }

    const updated = await prisma.registration.update({
      where: { id: req.params.id },
      data: {
        classroomId,
        status: 'ACCEPTED',
      },
      include: {
        classroom: { select: { name: true, homeroomTeacher: true } },
        parent: { select: { name: true, email: true } },
      },
    });

    return successResponse(res, updated, `Siswa berhasil ditetapkan di Kelas ${classroom.name}.`);
  } catch (err) {
    console.error('[PPDB-Admin/AssignClass]', err);
    return errorResponse(res, 'Terjadi kesalahan server.', 500);
  }
};
