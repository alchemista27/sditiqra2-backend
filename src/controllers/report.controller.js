// src/controllers/report.controller.js
// Excel report generation dengan 3 sheets: Summary, Detail Harian, Log Anomali
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');

let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch (e) {
  console.warn('[Report] exceljs belum terinstall. Jalankan: npm install exceljs');
}

// ─── GET /reports/attendance/excel?month=3&year=2026 ─────────
exports.generateAttendanceExcel = async (req, res) => {
  try {
    if (!ExcelJS) {
      return errorResponse(res, 'Library exceljs belum terinstall. Jalankan: npm install exceljs', 500);
    }

    const { month, year } = req.query;
    if (!month || !year) {
      return errorResponse(res, 'Parameter month dan year wajib diisi', 400);
    }

    const m = parseInt(month);
    const y = parseInt(year);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0); // Last day of month
    const daysInMonth = endDate.getDate();

    // Ambil semua karyawan aktif
    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { name: true, email: true } },
        attendanceLogs: {
          where: {
            date: { gte: startDate, lte: endDate }
          },
          orderBy: { date: 'asc' }
        }
      },
      orderBy: { user: { name: 'asc' } }
    });

    // Ambil hari libur dalam bulan
    const holidays = await prisma.holiday.findMany({
      where: {
        date: { gte: startDate, lte: endDate }
      }
    });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));

    // Hitung jumlah hari kerja (exclude Minggu & hari libur)
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      if (date.getDay() !== 0 && !holidayDates.has(dateStr)) {
        workingDays++;
      }
    }

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SDIT Iqra 2 Bengkulu';
    workbook.created = new Date();

    const monthNames = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    // ═══════════════════════════════════════════════════════════
    // SHEET 1: Summary (Rekapitulasi)
    // ═══════════════════════════════════════════════════════════
    const sheetSummary = workbook.addWorksheet('Summary');
    
    // Title
    sheetSummary.mergeCells('A1:F1');
    const titleRow = sheetSummary.getRow(1);
    titleRow.getCell(1).value = `Rekapitulasi Kehadiran - ${monthNames[m]} ${y}`;
    titleRow.getCell(1).font = { bold: true, size: 14 };
    titleRow.getCell(1).alignment = { horizontal: 'center' };

    sheetSummary.mergeCells('A2:F2');
    sheetSummary.getRow(2).getCell(1).value = 'SDIT Iqra 2 Kota Bengkulu';
    sheetSummary.getRow(2).getCell(1).font = { bold: true, size: 12 };
    sheetSummary.getRow(2).getCell(1).alignment = { horizontal: 'center' };

    // Headers
    const summaryHeaders = ['No', 'Nama Karyawan', 'Tepat Waktu', 'Terlambat', 'Izin/Cuti/Sakit', '% Kehadiran'];
    const headerRow = sheetSummary.getRow(4);
    summaryHeaders.forEach((header, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    // Column widths
    sheetSummary.getColumn(1).width = 5;
    sheetSummary.getColumn(2).width = 30;
    sheetSummary.getColumn(3).width = 15;
    sheetSummary.getColumn(4).width = 15;
    sheetSummary.getColumn(5).width = 18;
    sheetSummary.getColumn(6).width = 15;

    // Data rows
    employees.forEach((emp, index) => {
      const logs = emp.attendanceLogs;
      const onTime = logs.filter(l => l.type === 'HADIR' && !l.isLate).length;
      const late = logs.filter(l => l.type === 'HADIR' && l.isLate).length;
      const leave = logs.filter(l => ['IZIN', 'SAKIT', 'CUTI', 'DINAS'].includes(l.type)).length;
      const totalPresent = onTime + late;
      const percentage = workingDays > 0 ? ((totalPresent / workingDays) * 100).toFixed(1) : '0.0';

      const row = sheetSummary.getRow(5 + index);
      row.getCell(1).value = index + 1;
      row.getCell(2).value = emp.user.name;
      row.getCell(3).value = onTime;
      row.getCell(4).value = late;
      row.getCell(5).value = leave;
      row.getCell(6).value = `${percentage}%`;

      // Styling
      for (let c = 1; c <= 6; c++) {
        const cell = row.getCell(c);
        cell.alignment = { horizontal: c === 2 ? 'left' : 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        if (index % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
        }
      }
    });

    // Info hari kerja
    const infoRow = sheetSummary.getRow(6 + employees.length);
    infoRow.getCell(1).value = `Total hari kerja bulan ini: ${workingDays} hari`;
    infoRow.getCell(1).font = { italic: true, size: 10 };

    // ═══════════════════════════════════════════════════════════
    // SHEET 2: Detail Harian
    // ═══════════════════════════════════════════════════════════
    const sheetDetail = workbook.addWorksheet('Detail Harian');

    // Title
    sheetDetail.mergeCells(1, 1, 1, daysInMonth + 2);
    sheetDetail.getRow(1).getCell(1).value = `Detail Kehadiran Harian - ${monthNames[m]} ${y}`;
    sheetDetail.getRow(1).getCell(1).font = { bold: true, size: 14 };
    sheetDetail.getRow(1).getCell(1).alignment = { horizontal: 'center' };

    // Headers: No, Nama, Tgl 1, Tgl 2, ..., Tgl 31
    const detailHeaderRow = sheetDetail.getRow(3);
    detailHeaderRow.getCell(1).value = 'No';
    detailHeaderRow.getCell(2).value = 'Nama';
    
    sheetDetail.getColumn(1).width = 5;
    sheetDetail.getColumn(2).width = 25;

    for (let d = 1; d <= daysInMonth; d++) {
      const cell = detailHeaderRow.getCell(d + 2);
      cell.value = d;
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      
      const date = new Date(y, m - 1, d);
      const dateStr = date.toISOString().split('T')[0];
      const isSunday = date.getDay() === 0;
      const isHoliday = holidayDates.has(dateStr);
      
      if (isSunday || isHoliday) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
        cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
      }
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };

      sheetDetail.getColumn(d + 2).width = 14;
    }

    // Style header No & Nama
    [1, 2].forEach(c => {
      const cell = detailHeaderRow.getCell(c);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    // Data rows
    employees.forEach((emp, index) => {
      const row = sheetDetail.getRow(4 + index);
      row.getCell(1).value = index + 1;
      row.getCell(2).value = emp.user.name;

      // Build lookup by date
      const logsByDate = {};
      emp.attendanceLogs.forEach(log => {
        const dateStr = new Date(log.date).toISOString().split('T')[0];
        logsByDate[dateStr] = log;
      });

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(y, m - 1, d);
        const dateStr = date.toISOString().split('T')[0];
        const cell = row.getCell(d + 2);
        const isSunday = date.getDay() === 0;
        const isHoliday = holidayDates.has(dateStr);

        if (isSunday || isHoliday) {
          cell.value = 'LIBUR';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };
          cell.font = { size: 8, color: { argb: 'FFD32F2F' } };
        } else if (logsByDate[dateStr]) {
          const log = logsByDate[dateStr];
          if (['IZIN', 'SAKIT', 'CUTI', 'DINAS'].includes(log.type)) {
            cell.value = log.type;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
            cell.font = { size: 8 };
          } else if (log.type === 'ALPHA') {
            cell.value = 'ALPHA';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };
            cell.font = { size: 8, color: { argb: 'FFD32F2F' } };
          } else {
            // HADIR — tampilkan jam masuk/keluar
            const clockIn = log.clockIn ? new Date(log.clockIn).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
            const clockOut = log.clockOut ? new Date(log.clockOut).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';
            cell.value = `${clockIn} / ${clockOut}`;
            cell.font = { size: 8 };
            
            if (log.isLate) {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0B2' } };
            }
          }
        } else {
          // Belum ada data — jika tanggal sudah lewat, anggap ALPHA
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (date < today) {
            cell.value = 'ALPHA';
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };
            cell.font = { size: 8, color: { argb: 'FFD32F2F' } };
          } else {
            cell.value = '-';
            cell.font = { size: 8, color: { argb: 'FF9E9E9E' } };
          }
        }

        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      }

      // Style No & Nama columns
      [1, 2].forEach(c => {
        const cell = row.getCell(c);
        cell.alignment = { horizontal: c === 1 ? 'center' : 'left', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
      });
    });

    // ═══════════════════════════════════════════════════════════
    // SHEET 3: Log Anomali
    // ═══════════════════════════════════════════════════════════
    const sheetAnomaly = workbook.addWorksheet('Log Anomali');

    // Title
    sheetAnomaly.mergeCells('A1:F1');
    sheetAnomaly.getRow(1).getCell(1).value = `Log Anomali Kehadiran - ${monthNames[m]} ${y}`;
    sheetAnomaly.getRow(1).getCell(1).font = { bold: true, size: 14 };
    sheetAnomaly.getRow(1).getCell(1).alignment = { horizontal: 'center' };

    // Headers
    const anomalyHeaders = ['No', 'Nama Karyawan', 'Tanggal', 'Jenis Anomali', 'Jarak (meter)', 'Keterangan'];
    const anomalyHeaderRow = sheetAnomaly.getRow(3);
    anomalyHeaders.forEach((header, i) => {
      const cell = anomalyHeaderRow.getCell(i + 1);
      cell.value = header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC62828' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    sheetAnomaly.getColumn(1).width = 5;
    sheetAnomaly.getColumn(2).width = 25;
    sheetAnomaly.getColumn(3).width = 15;
    sheetAnomaly.getColumn(4).width = 20;
    sheetAnomaly.getColumn(5).width = 15;
    sheetAnomaly.getColumn(6).width = 35;

    // Get all anomaly logs
    const anomalyLogs = await prisma.attendanceLog.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
        anomalyFlag: { not: null }
      },
      include: {
        employee: {
          include: { user: { select: { name: true } } }
        }
      },
      orderBy: { date: 'asc' }
    });

    const anomalyLabels = {
      'OUT_OF_RADIUS': 'Di Luar Radius',
      'MOCK_GPS': 'Fake GPS Terdeteksi',
      'LOW_FACE_CONFIDENCE': 'Pengenalan Wajah Gagal'
    };

    anomalyLogs.forEach((log, index) => {
      const row = sheetAnomaly.getRow(4 + index);
      row.getCell(1).value = index + 1;
      row.getCell(2).value = log.employee.user.name;
      row.getCell(3).value = new Date(log.date).toLocaleDateString('id-ID');
      row.getCell(4).value = anomalyLabels[log.anomalyFlag] || log.anomalyFlag;
      row.getCell(5).value = log.clockInDistance ? `${Math.round(log.clockInDistance)}m` : '-';
      row.getCell(6).value = log.anomalyNote || '-';

      for (let c = 1; c <= 6; c++) {
        const cell = row.getCell(c);
        cell.alignment = { horizontal: c <= 1 ? 'center' : 'left', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        if (index % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
        }
      }
    });

    if (anomalyLogs.length === 0) {
      sheetAnomaly.getRow(4).getCell(1).value = 'Tidak ada anomali ditemukan pada bulan ini.';
      sheetAnomaly.mergeCells('A4:F4');
      sheetAnomaly.getRow(4).getCell(1).alignment = { horizontal: 'center' };
      sheetAnomaly.getRow(4).getCell(1).font = { italic: true, color: { argb: 'FF4CAF50' } };
    }

    // ═══════════════════════════════════════════════════════════
    // Generate & Send File
    // ═══════════════════════════════════════════════════════════
    const filename = `Laporan_Kehadiran_${monthNames[m]}_${y}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('[Report] Error generating Excel:', err);
    errorResponse(res, err.message, 500);
  }
};

// ─── GET /reports/attendance/summary?month=3&year=2026 ───────
// JSON summary (opsional, untuk dashboard)
exports.getAttendanceSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return errorResponse(res, 'Parameter month dan year wajib diisi', 400);
    }

    const m = parseInt(month);
    const y = parseInt(year);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0);

    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      include: {
        user: { select: { name: true } },
        attendanceLogs: {
          where: { date: { gte: startDate, lte: endDate } }
        }
      },
      orderBy: { user: { name: 'asc' } }
    });

    // Hitung hari kerja
    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: startDate, lte: endDate } }
    });
    const holidayDates = new Set(holidays.map(h => h.date.toISOString().split('T')[0]));
    const daysInMonth = endDate.getDate();
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m - 1, d);
      if (date.getDay() !== 0 && !holidayDates.has(date.toISOString().split('T')[0])) {
        workingDays++;
      }
    }

    const summary = employees.map(emp => {
      const logs = emp.attendanceLogs;
      const onTime = logs.filter(l => l.type === 'HADIR' && !l.isLate).length;
      const late = logs.filter(l => l.type === 'HADIR' && l.isLate).length;
      const leave = logs.filter(l => ['IZIN', 'SAKIT', 'CUTI', 'DINAS'].includes(l.type)).length;
      const totalPresent = onTime + late;
      const percentage = workingDays > 0 ? parseFloat(((totalPresent / workingDays) * 100).toFixed(1)) : 0;

      return {
        employeeId: emp.id,
        name: emp.user.name,
        onTime,
        late,
        leave,
        totalPresent,
        percentage
      };
    });

    successResponse(res, {
      month: m,
      year: y,
      workingDays,
      totalEmployees: employees.length,
      summary
    }, `Rekapitulasi kehadiran ${m}/${y}`);
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};
