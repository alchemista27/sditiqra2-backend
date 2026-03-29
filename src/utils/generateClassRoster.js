// src/utils/generateClassRoster.js
// Generate PDF daftar siswa per kelas menggunakan pdf-lib

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/**
 * Generate PDF daftar siswa untuk satu kelas.
 * @param {Object} classroom - Data kelas (id, name, homeroomTeacher, maxStudents)
 * @param {Array}  students  - Array registrasi yang sudah di-include parent & academicYear
 * @param {string} siteName  - Nama sekolah dari settings
 * @returns {Promise<Buffer>}
 */
async function generateClassRoster(classroom, students, siteName = 'SD IT Iqra 2 Kota Bengkulu') {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 portrait
  const { width, height } = page.getSize();

  const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const black     = rgb(0, 0, 0);
  const darkGreen = rgb(0.04, 0.4, 0.18);
  const gray      = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.95, 0.95, 0.95);

  const marginX = 50;
  const contentWidth = width - marginX * 2;
  let y = height - 50;

  // ── KOP ────────────────────────────────────────────────────
  page.drawLine({
    start: { x: marginX, y: y + 8 }, end: { x: width - marginX, y: y + 8 },
    thickness: 3, color: darkGreen,
  });

  page.drawText(siteName.toUpperCase(), {
    x: marginX, y, size: 16, font: fontBold, color: darkGreen,
  });

  y -= 18;
  page.drawText('Jl. Raden Fatah RT.01 RW.01, Kel. Pagar Dewa, Kec. Selebar, Kota Bengkulu', {
    x: marginX, y, size: 9, font: fontRegular, color: gray,
  });

  y -= 14;
  page.drawLine({
    start: { x: marginX, y }, end: { x: width - marginX, y },
    thickness: 1, color: darkGreen,
  });

  // ── JUDUL ──────────────────────────────────────────────────
  y -= 30;
  const title = `DAFTAR SISWA KELAS ${classroom.name}`;
  const titleW = fontBold.widthOfTextAtSize(title, 14);
  page.drawText(title, {
    x: (width - titleW) / 2, y, size: 14, font: fontBold, color: black,
  });

  y -= 18;
  const ayName = students.length > 0 ? (students[0].academicYear?.name || '') : '';
  const sub = `Tahun Ajaran ${ayName} | Wali Kelas: ${classroom.homeroomTeacher || 'Belum Ditetapkan'}`;
  const subW = fontRegular.widthOfTextAtSize(sub, 10);
  page.drawText(sub, {
    x: (width - subW) / 2, y, size: 10, font: fontRegular, color: gray,
  });

  y -= 6;
  page.drawLine({
    start: { x: marginX + 30, y }, end: { x: width - marginX - 30, y },
    thickness: 0.5, color: gray,
  });

  // ── TABEL HEADER ───────────────────────────────────────────
  y -= 22;
  const colX   = [marginX, marginX + 30, marginX + 200, marginX + 320, marginX + 460];
  const headers = ['No', 'Nama Lengkap Siswa', 'No. Registrasi', 'Nama Orang Tua/Wali', 'Jenis Kelamin'];
  const colW   = [30, 170, 120, 140, 85];

  // Background header
  page.drawRectangle({
    x: marginX, y: y - 5, width: contentWidth, height: 20,
    color: darkGreen,
  });

  headers.forEach((h, i) => {
    page.drawText(h, { x: colX[i] + 3, y: y - 1, size: 9, font: fontBold, color: rgb(1,1,1) });
  });

  // ── BARIS DATA ─────────────────────────────────────────────
  y -= 25;
  const rowH = 20;

  if (students.length === 0) {
    page.drawText('Belum ada siswa yang ditempatkan di kelas ini.', {
      x: marginX + 10, y, size: 10, font: fontRegular, color: gray,
    });
  } else {
    students.forEach((r, i) => {
      // Alternating row background
      if (i % 2 === 0) {
        page.drawRectangle({ x: marginX, y: y - 5, width: contentWidth, height: rowH, color: lightGray });
      }

      const gender = r.gender === 'L' ? 'Laki-laki' : r.gender === 'P' ? 'Perempuan' : '-';
      const rowData = [
        String(i + 1),
        truncate(r.studentName || '-', fontBold, 10, colW[1] - 10),
        r.registrationNo,
        truncate(r.parent?.name || '-', fontRegular, 10, colW[3] - 10),
        gender,
      ];

      const fonts = [fontRegular, fontBold, fontRegular, fontRegular, fontRegular];
      rowData.forEach((val, j) => {
        page.drawText(val, { x: colX[j] + 3, y, size: 10, font: fonts[j], color: black });
      });

      // Garis bawah baris
      y -= rowH;
      page.drawLine({
        start: { x: marginX, y }, end: { x: width - marginX, y },
        thickness: 0.3, color: rgb(0.85, 0.85, 0.85),
      });
    });
  }

  // ── RINGKASAN ──────────────────────────────────────────────
  y -= 15;
  page.drawText(`Total Siswa: ${students.length} dari ${classroom.maxStudents} kapasitas`, {
    x: marginX, y, size: 10, font: fontBold, color: darkGreen,
  });

  // ── TANDA TANGAN ──────────────────────────────────────────
  y -= 40;
  const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const ttdX = width - marginX - 180;

  page.drawText(`Bengkulu, ${dateStr}`, { x: ttdX, y, size: 10, font: fontRegular, color: black });
  y -= 14;
  page.drawText('Panitia PPDB / Kepala Sekolah,', { x: ttdX, y, size: 10, font: fontRegular, color: black });
  y -= 65;
  page.drawText('(_______________________)', { x: ttdX, y, size: 10, font: fontRegular, color: black });

  // ── FOOTER ────────────────────────────────────────────────
  page.drawLine({
    start: { x: marginX, y: 32 }, end: { x: width - marginX, y: 32 },
    thickness: 0.5, color: gray,
  });
  page.drawText(`Dicetak otomatis oleh Sistem PPDB • Kelas ${classroom.name} • ${dateStr}`, {
    x: marginX, y: 18, size: 8, font: fontRegular, color: gray,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/** Potong teks agar tidak melebihi lebar kolom */
function truncate(text, font, size, maxWidth) {
  let t = text;
  while (t.length > 3 && font.widthOfTextAtSize(t, size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t.length < text.length ? t + '…' : t;
}

module.exports = { generateClassRoster };
