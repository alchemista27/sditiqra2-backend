// src/utils/generateClinicLetter.js
// Generate surat pengantar pemeriksaan kesehatan ke klinik IMC
// menggunakan pdf-lib (ringan, tanpa ketergantungan Chrome/Puppeteer)

const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/**
 * Generate PDF surat pengantar klinik IMC untuk calon siswa.
 * @param {Object} registration - Data registrasi dari Prisma (include parent)
 * @param {string} referralNo - Nomor surat pengantar yang sudah di-generate
 * @returns {Promise<Buffer>} - Buffer PDF yang bisa dikirim sebagai response
 */
async function generateClinicLetter(registration, referralNo) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4 dalam points (1pt = 1/72 inch)

  const { width, height } = page.getSize();

  // Font
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Warna
  const black = rgb(0, 0, 0);
  const darkGreen = rgb(0.04, 0.4, 0.18);
  const gray = rgb(0.4, 0.4, 0.4);

  let y = height - 60;
  const marginX = 60;
  const contentWidth = width - marginX * 2;

  // ── KOP SURAT ──────────────────────────────────────────────
  // Garis atas kop
  page.drawLine({
    start: { x: marginX, y: y + 10 },
    end: { x: width - marginX, y: y + 10 },
    thickness: 3,
    color: darkGreen,
  });

  // Nama sekolah
  page.drawText('SD IT IQRA 2 KOTA BENGKULU', {
    x: marginX,
    y,
    size: 18,
    font: fontBold,
    color: darkGreen,
  });

  y -= 20;
  page.drawText('Jl. Adam Malik No. 1, Bengkulu', {
    x: marginX,
    y,
    size: 10,
    font: fontRegular,
    color: gray,
  });

  y -= 16;
  page.drawText('Telp: (0736) 123456 | Email: info@sditiqra2bengkulu.sch.id', {
    x: marginX,
    y,
    size: 10,
    font: fontRegular,
    color: gray,
  });

  y -= 14;
  // Garis bawah kop
  page.drawLine({
    start: { x: marginX, y: y },
    end: { x: width - marginX, y: y },
    thickness: 1.5,
    color: darkGreen,
  });

  // ── JUDUL SURAT ────────────────────────────────────────────
  y -= 40;
  const titleText = 'SURAT PENGANTAR PEMERIKSAAN KESEHATAN';
  const titleWidth = fontBold.widthOfTextAtSize(titleText, 14);
  page.drawText(titleText, {
    x: (width - titleWidth) / 2,
    y,
    size: 14,
    font: fontBold,
    color: black,
  });

  y -= 20;
  const noText = `Nomor: ${referralNo}`;
  const noWidth = fontRegular.widthOfTextAtSize(noText, 11);
  page.drawText(noText, {
    x: (width - noWidth) / 2,
    y,
    size: 11,
    font: fontRegular,
    color: gray,
  });

  // Garis bawah judul
  y -= 14;
  page.drawLine({
    start: { x: marginX + 40, y },
    end: { x: width - marginX - 40, y },
    thickness: 0.5,
    color: gray,
  });

  // ── PEMBUKA ────────────────────────────────────────────────
  y -= 30;

  const today = new Date();
  const dateStr = today.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const openingText = `Yang bertanda tangan di bawah ini, Kepala SD IT Iqra 2 Kota Bengkulu, menerangkan bahwa:`;
  page.drawText(openingText, {
    x: marginX, y, size: 11, font: fontRegular, color: black, maxWidth: contentWidth,
  });

  // ── DATA SISWA (tabel sederhana) ───────────────────────────
  y -= 40;
  const birthDate = registration.birthDate
    ? new Date(registration.birthDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';

  const tableData = [
    ['Nama Lengkap', registration.studentName || '-'],
    ['Jenis Kelamin', registration.gender === 'L' ? 'Laki-laki' : registration.gender === 'P' ? 'Perempuan' : '-'],
    ['Tempat, Tanggal Lahir', `${registration.birthPlace || '-'}, ${birthDate}`],
    ['No. Pendaftaran PPDB', registration.registrationNo],
    ['Nama Orang Tua / Wali', registration.parent?.name || '-'],
  ];

  const labelX = marginX + 10;
  const colonX = marginX + 170;
  const valueX = marginX + 185;
  const rowHeight = 22;

  for (const [label, value] of tableData) {
    page.drawText(label, { x: labelX, y, size: 11, font: fontRegular, color: black });
    page.drawText(':', { x: colonX, y, size: 11, font: fontRegular, color: black });
    page.drawText(value, { x: valueX, y, size: 11, font: fontBold, color: black, maxWidth: contentWidth - 185 });
    y -= rowHeight;
  }

  // ── ISI SURAT ──────────────────────────────────────────────
  y -= 20;

  const body1 = `Calon siswa tersebut di atas adalah peserta PPDB SD IT Iqra 2 Kota Bengkulu Tahun Ajaran 2026/2027 yang telah dinyatakan LULUS dalam tahap Seleksi Administrasi.`;
  y = drawTextWrapped(page, body1, marginX, y, contentWidth, 11, fontRegular, black, 16);

  y -= 16;
  const body2 = `Sehubungan dengan persyaratan pendaftaran, kami mohon dengan hormat agar calon siswa tersebut dapat menjalani pemeriksaan kesehatan di:`;
  y = drawTextWrapped(page, body2, marginX, y, contentWidth, 11, fontRegular, black, 16);

  y -= 25;
  // Box nama klinik
  page.drawRectangle({
    x: marginX, y: y - 10, width: contentWidth, height: 60,
    borderColor: darkGreen, borderWidth: 1.5,
    color: rgb(0.94, 0.98, 0.95),
  });

  y -= 2;
  page.drawText('Iqra Medical Clinic (IMC)', {
    x: marginX + 15, y, size: 13, font: fontBold, color: darkGreen,
  });
  y -= 18;
  page.drawText('Jl. Adam Malik No. 1, Bengkulu', {
    x: marginX + 15, y, size: 11, font: fontRegular, color: black,
  });
  y -= 16;
  page.drawText('Jam Operasional: Senin–Sabtu, 08.00–16.00 WIB', {
    x: marginX + 15, y, size: 10, font: fontRegular, color: gray,
  });

  y -= 30;
  const body3 = `Hasil pemeriksaan kesehatan dari klinik tersebut harap diserahkan melalui portal pendaftaran online PPDB SD IT Iqra 2 Bengkulu dalam waktu 14 (empat belas) hari kerja sejak surat ini diterbitkan.`;
  y = drawTextWrapped(page, body3, marginX, y, contentWidth, 11, fontRegular, black, 16);

  y -= 10;
  const body4 = `Demikian surat pengantar ini dibuat untuk dapat digunakan sebagaimana mestinya. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.`;
  y = drawTextWrapped(page, body4, marginX, y, contentWidth, 11, fontRegular, black, 16);

  // ── TANDA TANGAN ──────────────────────────────────────────
  y -= 40;
  const ttdX = width - marginX - 200;

  page.drawText(`Bengkulu, ${dateStr}`, {
    x: ttdX, y, size: 11, font: fontRegular, color: black,
  });

  y -= 16;
  page.drawText('Kepala Sekolah,', {
    x: ttdX, y, size: 11, font: fontRegular, color: black,
  });

  // Ruang tanda tangan
  y -= 70;
  page.drawText('_______________________', {
    x: ttdX - 5, y, size: 11, font: fontRegular, color: black,
  });

  y -= 16;
  page.drawText('Kepala SD IT Iqra 2 Bengkulu', {
    x: ttdX, y, size: 10, font: fontRegular, color: gray,
  });

  // ── CATATAN KAKI ──────────────────────────────────────────
  y = 40;
  page.drawLine({
    start: { x: marginX, y: y + 16 },
    end: { x: width - marginX, y: y + 16 },
    thickness: 0.5, color: gray,
  });
  page.drawText(`Surat ini diterbitkan secara otomatis oleh sistem PPDB • ${referralNo} • ${dateStr}`, {
    x: marginX, y, size: 8, font: fontRegular, color: gray,
  });

  // ── SERIALIZE ─────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * Helper: gambar teks dengan word-wrap sederhana.
 * @returns {number} y posisi setelah teks selesai digambar
 */
function drawTextWrapped(page, text, x, y, maxWidth, fontSize, font, color, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth && line) {
      page.drawText(line, { x, y: currentY, size: fontSize, font, color });
      currentY -= lineHeight;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    page.drawText(line, { x, y: currentY, size: fontSize, font, color });
    currentY -= lineHeight;
  }

  return currentY;
}

module.exports = { generateClinicLetter };
