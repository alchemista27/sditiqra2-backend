// src/controllers/attendance.controller.js
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');

// Helper untuk mendapatkan objek Employee dari User ID
const getMyEmployeeRecord = async (userId) => {
  let employee = await prisma.employee.findUnique({
    where: { userId }
  });
  
  // Auto-create for MVP purposes jika belum ada
  if (!employee) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    employee = await prisma.employee.create({
      data: {
        userId,
        nip: `NIP-${Math.floor(Math.random() * 100000)}`,
        position: user.role === 'GURU' ? 'Guru Kelas' : 'Pegawai',
        joinDate: new Date(),
        status: 'ACTIVE'
      }
    });
  }
  return employee;
};

// ─── KARYAWAN: Pencatatan Kehadiran (Clock In / Out) ──────────────────────

exports.clockIn = async (req, res) => {
  try {
    const employee = await getMyEmployeeRecord(req.user.id);
    
    // Gunakan tanggal hari ini (buang time/jam untuk date match)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Cek apakah sudah absen hari ini
    const existingLog = await prisma.attendanceLog.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: today
        }
      }
    });

    if (existingLog && existingLog.clockIn) {
      return errorResponse(res, 'Anda sudah melakukan clock in hari ini.', 400);
    }

    const log = await prisma.attendanceLog.upsert({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: today
        }
      },
      create: {
        employeeId: employee.id,
        date: today,
        clockIn: new Date(),
        type: 'HADIR'
      },
      update: {
        clockIn: new Date(),
        type: 'HADIR'
      }
    });

    successResponse(res, log, 'Berhasil clock in!', 201);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

exports.clockOut = async (req, res) => {
  try {
    const employee = await getMyEmployeeRecord(req.user.id);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingLog = await prisma.attendanceLog.findUnique({
      where: {
        employeeId_date: {
          employeeId: employee.id,
          date: today
        }
      }
    });

    if (!existingLog || !existingLog.clockIn) {
      return errorResponse(res, 'Anda belum melakukan clock in hari ini.', 400);
    }
    if (existingLog.clockOut) {
      return errorResponse(res, 'Anda sudah melakukan clock out hari ini.', 400);
    }

    const log = await prisma.attendanceLog.update({
      where: { id: existingLog.id },
      data: { clockOut: new Date() }
    });

    successResponse(res, log, 'Berhasil clock out!');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

exports.getMyLogs = async (req, res) => {
  try {
    const employee = await getMyEmployeeRecord(req.user.id);
    const { month, year } = req.query; // format 01..12, 2026
    
    let dateFilter = {};
    if (month && year) {
      const startDate = new Date(year, parseInt(month) - 1, 1);
      const endDate = new Date(year, parseInt(month), 0);
      endDate.setHours(23, 59, 59, 999);
      
      dateFilter = {
        date: {
          gte: startDate,
          lte: endDate
        }
      };
    }

    const logs = await prisma.attendanceLog.findMany({
      where: {
        employeeId: employee.id,
        ...dateFilter
      },
      orderBy: { date: 'desc' }
    });

    successResponse(res, logs, 'Riwayat kehadiran Anda');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── ADMIN: Pemantauan Kehadiran ──────────────────────

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

    successResponse(res, logs, 'Data kehadiran semua pegawai hari ini');
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
      orderBy: { joinDate: 'desc' } 
    });
    successResponse(res, employees, 'Daftar Pegawai & Guru');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};
