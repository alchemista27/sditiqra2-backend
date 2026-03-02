// src/controllers/ppdb.controller.js
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');

// ─── ADMIN: Manajemen Pendaftaran PPDB ──────────────────────

exports.getAllRegistrations = async (req, res) => {
  try {
    const { status, academicYearId } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (academicYearId) filter.academicYearId = academicYearId;

    const registrations = await prisma.registration.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' },
      include: {
        parent: {
          select: { name: true, phone: true }
        },
        academicYear: {
          select: { name: true }
        }
      }
    });
    
    successResponse(res, registrations, 'Data pendaftaran berhasil diambil');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

exports.getRegistrationDetail = async (req, res) => {
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: req.params.id },
      include: {
        parent: {
          select: { name: true, phone: true, email: true, nik: true, address: true }
        },
        academicYear: true
      }
    });
    
    if (!registration) return errorResponse(res, 'Pendaftaran tidak ditemukan', 404);
    successResponse(res, registration, 'Detail pendaftaran');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectReason } = req.body;
    
    const data = { status, verifiedAt: new Date() };
    if (status === 'REJECTED') data.rejectReason = rejectReason;
    if (status === 'ACCEPTED') data.rejectReason = null;

    const registration = await prisma.registration.update({
      where: { id },
      data,
      include: {
        parent: { select: { name: true } }
      }
    });
    
    successResponse(res, registration, 'Status pendaftaran telah diperbarui');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

// ─── PUBLIK / ORANG TUA: Pendaftaran Baru ─────────────────

const generateRegistrationNo = () => {
  const date = new Date();
  const year = date.getFullYear().toString().substring(2);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PPDB-${year}-${random}`;
};

exports.register = async (req, res) => {
  try {
    const { 
      parentId, 
      studentName, gender, birthPlace, birthDate, religion, address, previousSchool 
    } = req.body;

    // Cek Tahun Ajaran Aktif
    const activeYear = await prisma.academicYear.findFirst({
      where: { isActive: true }
    });
    
    if (!activeYear) {
      return errorResponse(res, 'Pendaftaran saat ini sedang ditutup. Tidak ada tahuan ajaran aktif.', 400);
    }

    // Cek Kuota Pendaftaran
    const countReg = await prisma.registration.count({
      where: { academicYearId: activeYear.id }
    });
    
    if (countReg >= activeYear.quota && activeYear.quota > 0) {
       return errorResponse(res, 'Mohon maaf, kuota pendaftaran tahun ajaran ini telah penuh.', 400);
    }

    // Menampung file upload jika ada menggunakan Multer dari request
    // Asumsi req.files digunakan oleh array uploads
    const files = req.files || {};
    const getPath = (fieldname) => files[fieldname] ? `/uploads/ppdb/${files[fieldname][0].filename}` : null;

    const registration = await prisma.registration.create({
      data: {
        registrationNo: generateRegistrationNo(),
        studentName,
        gender, // L atau P
        birthPlace,
        birthDate: new Date(birthDate),
        religion,
        address,
        previousSchool,
        
        photo: getPath('photo'),
        docBirthCert: getPath('docBirthCert'),
        docKartuKeluarga: getPath('docKartuKeluarga'),
        docIjazahTK: getPath('docIjazahTK'),
        
        status: 'PENDING',
        
        parentId, // Harus berasal dari middleware auth parent atau login frontend portal
        academicYearId: activeYear.id,
      }
    });

    successResponse(res, registration, 'Pendaftaran berhasil disubmit! Menunggu verifikasi berkas.', 201);
  } catch (err) {
    if (err.code === 'P2002') return errorResponse(res, 'Nomor pendaftaran duplikat. Coba submit lagi.', 400);
    errorResponse(res, err.message, 500);
  }
};

exports.getMyRegistrations = async (req, res) => {
  try {
    const parentId = req.user.id; // Dari middleware auth
    
    const registrations = await prisma.registration.findMany({
      where: { parentId },
      orderBy: { createdAt: 'desc' },
      include: {
        academicYear: { select: { name: true } }
      }
    });
    
    successResponse(res, registrations, 'Data pendaftaran Anda');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};
