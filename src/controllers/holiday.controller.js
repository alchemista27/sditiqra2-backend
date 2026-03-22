// src/controllers/holiday.controller.js
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');

// ─── Data hari libur nasional Indonesia 2026 ──────────────────
const NATIONAL_HOLIDAYS_2026 = [
  { date: '2026-01-01', name: 'Tahun Baru Masehi' },
  { date: '2026-01-29', name: 'Tahun Baru Imlek 2577' },
  { date: '2026-02-17', name: 'Isra Mikraj Nabi Muhammad SAW' },
  { date: '2026-03-22', name: 'Hari Raya Nyepi Tahun Baru Saka 1948' },
  { date: '2026-03-29', name: 'Hari Raya Idul Fitri 1447 H (Hari 1)' },
  { date: '2026-03-30', name: 'Hari Raya Idul Fitri 1447 H (Hari 2)' },
  { date: '2026-04-03', name: 'Wafat Isa Al-Masih' },
  { date: '2026-05-01', name: 'Hari Buruh Internasional' },
  { date: '2026-05-14', name: 'Kenaikan Isa Al-Masih' },
  { date: '2026-05-16', name: 'Hari Raya Waisak 2570' },
  { date: '2026-06-01', name: 'Hari Lahir Pancasila' },
  { date: '2026-06-05', name: 'Hari Raya Idul Adha 1447 H' },
  { date: '2026-06-26', name: 'Tahun Baru Islam 1448 H' },
  { date: '2026-08-17', name: 'Hari Kemerdekaan RI' },
  { date: '2026-09-04', name: 'Maulid Nabi Muhammad SAW 1448 H' },
  { date: '2026-12-25', name: 'Hari Raya Natal' },
];

// ─── GET /holidays ───────────────────────────────────────────
// List semua hari libur, opsional filter tahun
exports.getAll = async (req, res) => {
  try {
    const { year, type } = req.query;
    
    let where = {};
    
    if (year) {
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      where.date = { gte: startDate, lte: endDate };
    }
    
    if (type) {
      where.type = type;
    }

    const holidays = await prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' }
    });

    successResponse(res, holidays, 'Daftar hari libur');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── POST /holidays ──────────────────────────────────────────
// Admin tambah hari libur manual
exports.create = async (req, res) => {
  try {
    const { date, name, type, isRecurring } = req.body;

    if (!date || !name) {
      return errorResponse(res, 'Tanggal dan nama hari libur wajib diisi', 400);
    }

    const holiday = await prisma.holiday.create({
      data: {
        date: new Date(date),
        name,
        type: type || 'SCHOOL',
        isRecurring: isRecurring || false
      }
    });

    successResponse(res, holiday, 'Hari libur berhasil ditambahkan', 201);
  } catch (err) {
    if (err.code === 'P2002') {
      return errorResponse(res, 'Hari libur dengan tanggal dan nama tersebut sudah ada', 409);
    }
    errorResponse(res, err.message, 500);
  }
};

// ─── PUT /holidays/:id ───────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, name, type, isRecurring } = req.body;

    const holiday = await prisma.holiday.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(name && { name }),
        ...(type && { type }),
        ...(isRecurring !== undefined && { isRecurring })
      }
    });

    successResponse(res, holiday, 'Hari libur berhasil diperbarui');
  } catch (err) {
    if (err.code === 'P2025') {
      return errorResponse(res, 'Hari libur tidak ditemukan', 404);
    }
    errorResponse(res, err.message, 500);
  }
};

// ─── DELETE /holidays/:id ────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.holiday.delete({ where: { id } });

    successResponse(res, null, 'Hari libur berhasil dihapus');
  } catch (err) {
    if (err.code === 'P2025') {
      return errorResponse(res, 'Hari libur tidak ditemukan', 404);
    }
    errorResponse(res, err.message, 500);
  }
};

// ─── GET /holidays/check/:date ───────────────────────────────
// Cek apakah tanggal tertentu adalah hari libur
exports.checkDate = async (req, res) => {
  try {
    const { date } = req.params;
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    // Cek hari Minggu
    const isSunday = checkDate.getDay() === 0;

    // Cek di database
    const holiday = await prisma.holiday.findFirst({
      where: {
        date: checkDate
      }
    });

    const isHoliday = isSunday || !!holiday;

    successResponse(res, {
      date: checkDate,
      isHoliday,
      isSunday,
      holiday: holiday || null,
      reason: isSunday ? 'Hari Minggu' : (holiday ? holiday.name : null)
    }, isHoliday ? 'Tanggal ini adalah hari libur' : 'Tanggal ini bukan hari libur');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── POST /holidays/seed-national/:year ──────────────────────
// Seed hari libur nasional Indonesia untuk tahun tertentu
exports.seedNational = async (req, res) => {
  try {
    const { year } = req.params;
    
    // Untuk 2026, gunakan data hardcoded
    // Untuk tahun lain, bisa ditambahkan atau fetch dari API
    let holidays = [];
    
    if (year === '2026') {
      holidays = NATIONAL_HOLIDAYS_2026;
    } else {
      return errorResponse(res, `Data hari libur nasional untuk tahun ${year} belum tersedia. Silakan tambahkan manual.`, 400);
    }

    let created = 0;
    let skipped = 0;

    for (const h of holidays) {
      try {
        await prisma.holiday.create({
          data: {
            date: new Date(h.date),
            name: h.name,
            type: 'NATIONAL',
            isRecurring: false
          }
        });
        created++;
      } catch (err) {
        if (err.code === 'P2002') {
          skipped++; // Sudah ada, skip
        } else {
          throw err;
        }
      }
    }

    successResponse(res, { created, skipped, total: holidays.length }, 
      `Berhasil seed ${created} hari libur nasional ${year} (${skipped} sudah ada)`);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};
