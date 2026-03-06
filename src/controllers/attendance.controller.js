// src/controllers/attendance.controller.js
// Refactored: GPS geofencing, anti-fake GPS, face recognition metadata, anomaly tracking
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');
const { isWithinRadius, validateGpsData, isWithinTimeWindow, isLateByThreshold } = require('../utils/geo.utils');

// Helper untuk mendapatkan objek Employee dari User ID
const getMyEmployeeRecord = async (userId) => {
  let employee = await prisma.employee.findUnique({
    where: { userId }
  });
  
  // Auto-create jika belum ada
  if (!employee) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    employee = await prisma.employee.create({
      data: {
        userId,
        nip: `NIP-${Date.now().toString().slice(-6)}`,
        position: user.role === 'KARYAWAN' ? 'Guru/Staf' : 'Pegawai',
        joinDate: new Date(),
        status: 'ACTIVE'
      }
    });
  }
  return employee;
};

// Helper untuk mendapatkan config aktif
const getActiveConfig = async () => {
  let config = await prisma.attendanceConfig.findFirst({
    where: { isActive: true }
  });
  
  // Auto-create default config jika belum ada
  if (!config) {
    config = await prisma.attendanceConfig.create({
      data: {} // Semua pakai default
    });
  }
  return config;
};

// ─── GET /attendance/config ──────────────────────────────────
// Ambil konfigurasi absensi (untuk mobile app dan dashboard)
exports.getConfig = async (req, res) => {
  try {
    const config = await getActiveConfig();
    successResponse(res, config, 'Konfigurasi absensi');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── PUT /attendance/config ──────────────────────────────────
// Admin update konfigurasi geofencing & jam kerja
exports.updateConfig = async (req, res) => {
  try {
    const config = await getActiveConfig();
    const {
      schoolName, schoolLatitude, schoolLongitude, radiusMeters,
      clockInStart, clockInEnd, clockOutStart, clockOutEnd,
      lateThreshold, minFaceConfidence, allowMockGps
    } = req.body;

    const updated = await prisma.attendanceConfig.update({
      where: { id: config.id },
      data: {
        ...(schoolName !== undefined && { schoolName }),
        ...(schoolLatitude !== undefined && { schoolLatitude: parseFloat(schoolLatitude) }),
        ...(schoolLongitude !== undefined && { schoolLongitude: parseFloat(schoolLongitude) }),
        ...(radiusMeters !== undefined && { radiusMeters: parseInt(radiusMeters) }),
        ...(clockInStart !== undefined && { clockInStart }),
        ...(clockInEnd !== undefined && { clockInEnd }),
        ...(clockOutStart !== undefined && { clockOutStart }),
        ...(clockOutEnd !== undefined && { clockOutEnd }),
        ...(lateThreshold !== undefined && { lateThreshold }),
        ...(minFaceConfidence !== undefined && { minFaceConfidence: parseFloat(minFaceConfidence) }),
        ...(allowMockGps !== undefined && { allowMockGps })
      }
    });

    successResponse(res, updated, 'Konfigurasi absensi berhasil diperbarui');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── POST /attendance/clock-in ───────────────────────────────
// Clock In dengan GPS validation, anti-fake GPS, face recognition
exports.clockIn = async (req, res) => {
  try {
    const employee = await getMyEmployeeRecord(req.user.id);
    const config = await getActiveConfig();
    const now = new Date();

    const {
      latitude, longitude, isMockGps = false,
      faceConfidence, selfieUrl
    } = req.body;

    // 1. Validasi GPS data
    const gpsValidation = validateGpsData({ latitude, longitude });
    if (!gpsValidation.valid) {
      return errorResponse(res, `Data GPS tidak valid: ${gpsValidation.errors.join(', ')}`, 400);
    }

    // 2. Anti-Fake GPS check
    if (isMockGps && !config.allowMockGps) {
      return errorResponse(res, 'Fake GPS terdeteksi! Anda tidak dapat melakukan absensi dengan GPS palsu.', 403);
    }

    // 3. Cek radius geofencing
    const radiusCheck = isWithinRadius(
      latitude, longitude,
      config.schoolLatitude, config.schoolLongitude,
      config.radiusMeters
    );

    // 4. Cek apakah hari ini libur
    const todayDate = new Date(now);
    todayDate.setHours(0, 0, 0, 0);

    const isSunday = todayDate.getDay() === 0;
    const holiday = await prisma.holiday.findFirst({
      where: { date: todayDate }
    });

    if (isSunday || holiday) {
      return errorResponse(res, 
        `Hari ini adalah hari libur${holiday ? ` (${holiday.name})` : ' (Minggu)'}. Tidak perlu absen.`, 400);
    }

    // 5. Cek apakah sudah absen hari ini
    const existingLog = await prisma.attendanceLog.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: todayDate
        }
      }
    });

    if (existingLog && existingLog.clockIn) {
      return errorResponse(res, 'Anda sudah melakukan clock in hari ini.', 400);
    }

    // 6. Tentukan anomaly flag
    let anomalyFlag = null;
    let anomalyNote = null;

    if (isMockGps) {
      anomalyFlag = 'MOCK_GPS';
      anomalyNote = 'Fake GPS terdeteksi saat clock in';
    } else if (!radiusCheck.isWithin) {
      anomalyFlag = 'OUT_OF_RADIUS';
      anomalyNote = `Clock in di luar radius (jarak: ${radiusCheck.distance}m, max: ${config.radiusMeters}m)`;
    }

    // 7. Cek keterlambatan
    const isLate = isLateByThreshold(config.lateThreshold, now);

    // 8. Buat / update log
    const log = await prisma.attendanceLog.upsert({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: todayDate
        }
      },
      create: {
        employeeId: employee.id,
        date: todayDate,
        clockIn: now,
        type: 'HADIR',
        clockInLat: latitude,
        clockInLng: longitude,
        clockInDistance: radiusCheck.distance,
        isMockGps: isMockGps || false,
        faceConfidence: faceConfidence || null,
        clockInSelfie: selfieUrl || null,
        isLate,
        anomalyFlag,
        anomalyNote
      },
      update: {
        clockIn: now,
        type: 'HADIR',
        clockInLat: latitude,
        clockInLng: longitude,
        clockInDistance: radiusCheck.distance,
        isMockGps: isMockGps || false,
        faceConfidence: faceConfidence || null,
        clockInSelfie: selfieUrl || null,
        isLate,
        anomalyFlag,
        anomalyNote
      }
    });

    const responseData = {
      ...log,
      distance: radiusCheck.distance,
      isWithinRadius: radiusCheck.isWithin,
      isLate,
      anomaly: anomalyFlag
    };

    // Warning jika di luar radius tapi tetap tercatat
    const message = anomalyFlag
      ? `Clock in berhasil (PERINGATAN: ${anomalyNote})`
      : isLate
        ? 'Clock in berhasil (Terlambat!)'
        : 'Berhasil clock in! ✅';

    successResponse(res, responseData, message, 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── POST /attendance/clock-out ──────────────────────────────
exports.clockOut = async (req, res) => {
  try {
    const employee = await getMyEmployeeRecord(req.user.id);
    const config = await getActiveConfig();
    const now = new Date();

    const {
      latitude, longitude, isMockGps = false,
      selfieUrl
    } = req.body;

    // 1. Validasi GPS
    const gpsValidation = validateGpsData({ latitude, longitude });
    if (!gpsValidation.valid) {
      return errorResponse(res, `Data GPS tidak valid: ${gpsValidation.errors.join(', ')}`, 400);
    }

    // 2. Anti-Fake GPS
    if (isMockGps && !config.allowMockGps) {
      return errorResponse(res, 'Fake GPS terdeteksi! Anda tidak dapat melakukan absensi dengan GPS palsu.', 403);
    }

    // 3. Cek radius
    const radiusCheck = isWithinRadius(
      latitude, longitude,
      config.schoolLatitude, config.schoolLongitude,
      config.radiusMeters
    );

    // 4. Cek apakah sudah clock in
    const todayDate = new Date(now);
    todayDate.setHours(0, 0, 0, 0);

    const existingLog = await prisma.attendanceLog.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: todayDate
        }
      }
    });

    if (!existingLog || !existingLog.clockIn) {
      return errorResponse(res, 'Anda belum melakukan clock in hari ini.', 400);
    }
    if (existingLog.clockOut) {
      return errorResponse(res, 'Anda sudah melakukan clock out hari ini.', 400);
    }

    // 5. Update anomaly jika ada
    let anomalyFlag = existingLog.anomalyFlag;
    let anomalyNote = existingLog.anomalyNote;

    if (isMockGps && !anomalyFlag) {
      anomalyFlag = 'MOCK_GPS';
      anomalyNote = 'Fake GPS terdeteksi saat clock out';
    } else if (!radiusCheck.isWithin && !anomalyFlag) {
      anomalyFlag = 'OUT_OF_RADIUS';
      anomalyNote = `Clock out di luar radius (jarak: ${radiusCheck.distance}m, max: ${config.radiusMeters}m)`;
    }

    // 6. Update log
    const log = await prisma.attendanceLog.update({
      where: { id: existingLog.id },
      data: {
        clockOut: now,
        clockOutLat: latitude,
        clockOutLng: longitude,
        clockOutDistance: radiusCheck.distance,
        clockOutSelfie: selfieUrl || null,
        // Update anomaly hanya jika sebelumnya belum ada
        ...(anomalyFlag !== existingLog.anomalyFlag && { anomalyFlag, anomalyNote })
      }
    });

    const message = anomalyFlag && anomalyFlag !== existingLog.anomalyFlag
      ? `Clock out berhasil (PERINGATAN: ${anomalyNote})`
      : 'Berhasil clock out! ✅';

    successResponse(res, {
      ...log,
      distance: radiusCheck.distance,
      isWithinRadius: radiusCheck.isWithin
    }, message);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── GET /attendance/my-logs ─────────────────────────────────
exports.getMyLogs = async (req, res) => {
  try {
    const employee = await getMyEmployeeRecord(req.user.id);
    const { month, year } = req.query;
    
    let dateFilter = {};
    if (month && year) {
      const startDate = new Date(year, parseInt(month) - 1, 1);
      const endDate = new Date(year, parseInt(month), 0);
      endDate.setHours(23, 59, 59, 999);
      dateFilter = { date: { gte: startDate, lte: endDate } };
    }

    const logs = await prisma.attendanceLog.findMany({
      where: { employeeId: employee.id, ...dateFilter },
      orderBy: { date: 'desc' }
    });

    successResponse(res, logs, 'Riwayat kehadiran Anda');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── GET /attendance/my-status ───────────────────────────────
// Status absensi hari ini (untuk mobile app)
exports.getMyStatus = async (req, res) => {
  try {
    const employee = await getMyEmployeeRecord(req.user.id);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayLog = await prisma.attendanceLog.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: today
        }
      }
    });

    // Cek hari libur
    const isSunday = today.getDay() === 0;
    const holiday = await prisma.holiday.findFirst({
      where: { date: today }
    });

    const config = await getActiveConfig();

    successResponse(res, {
      today: today.toISOString(),
      isHoliday: isSunday || !!holiday,
      holidayName: isSunday ? 'Hari Minggu' : (holiday ? holiday.name : null),
      hasClockIn: !!(todayLog && todayLog.clockIn),
      hasClockOut: !!(todayLog && todayLog.clockOut),
      clockIn: todayLog?.clockIn || null,
      clockOut: todayLog?.clockOut || null,
      isLate: todayLog?.isLate || false,
      log: todayLog,
      config: {
        schoolLatitude: config.schoolLatitude,
        schoolLongitude: config.schoolLongitude,
        radiusMeters: config.radiusMeters,
        clockInStart: config.clockInStart,
        clockInEnd: config.clockInEnd,
        clockOutStart: config.clockOutStart,
        clockOutEnd: config.clockOutEnd,
        lateThreshold: config.lateThreshold
      }
    }, 'Status absensi hari ini');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── ADMIN: Pemantauan Kehadiran ──────────────────────────────

exports.getAllLogsToday = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const logs = await prisma.attendanceLog.findMany({
      where: { date: today },
      include: {
        employee: {
          include: { user: { select: { name: true, email: true } } }
        }
      },
      orderBy: { clockIn: 'desc' }
    });

    // Hitung statistik
    const stats = {
      total: logs.length,
      onTime: logs.filter(l => l.type === 'HADIR' && !l.isLate).length,
      late: logs.filter(l => l.type === 'HADIR' && l.isLate).length,
      leave: logs.filter(l => ['IZIN', 'SAKIT', 'CUTI', 'DINAS'].includes(l.type)).length,
      anomalies: logs.filter(l => l.anomalyFlag).length
    };

    successResponse(res, { logs, stats }, 'Data kehadiran semua pegawai hari ini');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

exports.getAllLogs = async (req, res) => {
  try {
    const { month, year, employeeId, type, page = 1, limit = 50 } = req.query;

    let where = {};

    if (month && year) {
      const startDate = new Date(year, parseInt(month) - 1, 1);
      const endDate = new Date(year, parseInt(month), 0);
      where.date = { gte: startDate, lte: endDate };
    }
    if (employeeId) where.employeeId = employeeId;
    if (type) where.type = type;

    const [logs, total] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        include: {
          employee: {
            include: { user: { select: { name: true, email: true } } }
          }
        },
        orderBy: { date: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.attendanceLog.count({ where })
    ]);

    successResponse(res, {
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    }, 'Data kehadiran');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── ADMIN: Log Anomali ──────────────────────────────────────
exports.getAnomalyLogs = async (req, res) => {
  try {
    const { month, year, page = 1, limit = 50 } = req.query;

    let where = { anomalyFlag: { not: null } };

    if (month && year) {
      const startDate = new Date(year, parseInt(month) - 1, 1);
      const endDate = new Date(year, parseInt(month), 0);
      where.date = { gte: startDate, lte: endDate };
    }

    const [logs, total] = await Promise.all([
      prisma.attendanceLog.findMany({
        where,
        include: {
          employee: {
            include: { user: { select: { name: true, email: true } } }
          }
        },
        orderBy: { date: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.attendanceLog.count({ where })
    ]);

    successResponse(res, {
      logs,
      pagination: {
        page: parseInt(page), limit: parseInt(limit),
        total, totalPages: Math.ceil(total / parseInt(limit))
      }
    }, 'Log anomali kehadiran');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      include: {
        user: { select: { name: true, email: true, role: true } }
      },
      orderBy: { user: { name: 'asc' } }
    });
    successResponse(res, employees, 'Daftar Pegawai & Guru');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};
