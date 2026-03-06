// src/controllers/leave.controller.js
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');

// Helper untuk mendapatkan objek Employee dari User ID
const getEmployeeByUserId = async (userId) => {
  const employee = await prisma.employee.findUnique({
    where: { userId }
  });
  if (!employee) {
    throw new Error('Data karyawan tidak ditemukan. Hubungi admin.');
  }
  return employee;
};

// ─── POST /leaves ────────────────────────────────────────────
// Karyawan ajukan izin/cuti/sakit
exports.create = async (req, res) => {
  try {
    const employee = await getEmployeeByUserId(req.user.id);
    const { type, startDate, endDate, reason, attachment } = req.body;

    if (!type || !startDate || !endDate || !reason) {
      return errorResponse(res, 'Tipe, tanggal mulai, tanggal selesai, dan alasan wajib diisi', 400);
    }

    // Validasi tanggal
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return errorResponse(res, 'Tanggal selesai harus setelah tanggal mulai', 400);
    }

    // Validasi tipe izin
    const validTypes = ['IZIN', 'SAKIT', 'CUTI', 'DINAS'];
    if (!validTypes.includes(type)) {
      return errorResponse(res, `Tipe izin harus salah satu dari: ${validTypes.join(', ')}`, 400);
    }

    // Cek apakah sudah ada pengajuan di rentang tanggal yang sama
    const existingRequest = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: employee.id,
        status: { not: 'REJECTED' },
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start }
          }
        ]
      }
    });

    if (existingRequest) {
      return errorResponse(res, 'Anda sudah memiliki pengajuan izin di rentang tanggal tersebut', 400);
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        type,
        startDate: start,
        endDate: end,
        reason,
        attachment: attachment || null,
        employeeId: employee.id
      },
      include: {
        employee: {
          include: { user: { select: { name: true } } }
        }
      }
    });

    successResponse(res, leaveRequest, 'Pengajuan izin berhasil dikirim', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── GET /leaves/my-requests ─────────────────────────────────
// Karyawan lihat riwayat pengajuan sendiri
exports.getMyRequests = async (req, res) => {
  try {
    const employee = await getEmployeeByUserId(req.user.id);
    const { status, page = 1, limit = 20 } = req.query;

    let where = { employeeId: employee.id };
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.leaveRequest.count({ where })
    ]);

    successResponse(res, {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }, 'Riwayat pengajuan izin');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── GET /leaves ─────────────────────────────────────────────
// Admin lihat semua pengajuan (filter by status, employee, date)
exports.getAll = async (req, res) => {
  try {
    const { status, employeeId, page = 1, limit = 20 } = req.query;

    let where = {};
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;

    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            include: { user: { select: { name: true, email: true } } }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.leaveRequest.count({ where })
    ]);

    successResponse(res, {
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }, 'Daftar semua pengajuan izin');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── PUT /leaves/:id/approve ─────────────────────────────────
// Admin approve pengajuan izin
exports.approve = async (req, res) => {
  try {
    const { id } = req.params;
    const { approverNote } = req.body;

    const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leaveRequest) {
      return errorResponse(res, 'Pengajuan izin tidak ditemukan', 404);
    }
    if (leaveRequest.status !== 'PENDING') {
      return errorResponse(res, `Pengajuan sudah ${leaveRequest.status === 'APPROVED' ? 'disetujui' : 'ditolak'}`, 400);
    }

    // Update leave request
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverNote: approverNote || null,
        approvedBy: req.user.id,
        approvedAt: new Date()
      },
      include: {
        employee: {
          include: { user: { select: { name: true } } }
        }
      }
    });

    // Auto-create AttendanceLog untuk setiap hari dalam rentang izin
    const start = new Date(leaveRequest.startDate);
    const end = new Date(leaveRequest.endDate);
    const attendanceType = leaveRequest.type === 'SAKIT' ? 'SAKIT' 
                         : leaveRequest.type === 'CUTI' ? 'CUTI'
                         : leaveRequest.type === 'DINAS' ? 'DINAS'
                         : 'IZIN';

    const currentDate = new Date(start);
    while (currentDate <= end) {
      // Skip hari Minggu
      if (currentDate.getDay() !== 0) {
        try {
          await prisma.attendanceLog.upsert({
            where: {
              employeeId_date: {
                employeeId: leaveRequest.employeeId,
                date: new Date(currentDate)
              }
            },
            create: {
              employeeId: leaveRequest.employeeId,
              date: new Date(currentDate),
              type: attendanceType,
              note: `${leaveRequest.type}: ${leaveRequest.reason}`
            },
            update: {
              type: attendanceType,
              note: `${leaveRequest.type}: ${leaveRequest.reason}`
            }
          });
        } catch (err) {
          // Jika gagal upsert satu hari, lanjutkan ke hari berikutnya
          console.error(`Gagal buat log absensi untuk tanggal ${currentDate}:`, err.message);
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    successResponse(res, updated, 'Pengajuan izin berhasil disetujui');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── PUT /leaves/:id/reject ──────────────────────────────────
// Admin reject pengajuan izin
exports.reject = async (req, res) => {
  try {
    const { id } = req.params;
    const { approverNote } = req.body;

    const leaveRequest = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leaveRequest) {
      return errorResponse(res, 'Pengajuan izin tidak ditemukan', 404);
    }
    if (leaveRequest.status !== 'PENDING') {
      return errorResponse(res, `Pengajuan sudah ${leaveRequest.status === 'APPROVED' ? 'disetujui' : 'ditolak'}`, 400);
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approverNote: approverNote || 'Pengajuan ditolak',
        approvedBy: req.user.id,
        approvedAt: new Date()
      },
      include: {
        employee: {
          include: { user: { select: { name: true } } }
        }
      }
    });

    successResponse(res, updated, 'Pengajuan izin ditolak');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── GET /leaves/:id ─────────────────────────────────────────
// Detail satu pengajuan
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          include: { user: { select: { name: true, email: true } } }
        }
      }
    });

    if (!leaveRequest) {
      return errorResponse(res, 'Pengajuan izin tidak ditemukan', 404);
    }

    successResponse(res, leaveRequest, 'Detail pengajuan izin');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};
