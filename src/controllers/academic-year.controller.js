// src/controllers/academic-year.controller.js
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');

// ─── ADMIN: CRUD Tahun Ajaran ─────────────────────────────

exports.getAll = async (req, res) => {
  try {
    const years = await prisma.academicYear.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { registrations: true }
        }
      }
    });
    successResponse(res, years, 'Data tahun ajaran berhasil diambil');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

exports.getActive = async (req, res) => {
  try {
    const year = await prisma.academicYear.findFirst({
      where: { isActive: true },
    });
    if (!year) return errorResponse(res, 'Tidak ada tahun ajaran yang aktif', 404);
    successResponse(res, year, 'Data tahun ajaran aktif');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

exports.create = async (req, res) => {
  try {
    const { name, registrationStart, registrationEnd, quota } = req.body;
    const year = await prisma.academicYear.create({
      data: {
        name,
        registrationStart: new Date(registrationStart),
        registrationEnd: new Date(registrationEnd),
        quota: parseInt(quota) || 0,
      }
    });
    successResponse(res, year, 'Tahun ajaran berhasil dibuat', 201);
  } catch (err) {
    if (err.code === 'P2002') return errorResponse(res, 'Nama tahun ajaran sudah ada', 400);
    errorResponse(res, err.message, 500);
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, registrationStart, registrationEnd, quota } = req.body;
    
    const year = await prisma.academicYear.update({
      where: { id },
      data: {
        name,
        ...(registrationStart && { registrationStart: new Date(registrationStart) }),
        ...(registrationEnd && { registrationEnd: new Date(registrationEnd) }),
        ...(quota !== undefined && { quota: parseInt(quota) }),
      }
    });
    successResponse(res, year, 'Tahun ajaran berhasil diperbarui');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

exports.setActive = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Non-aktifkan semua
    await prisma.academicYear.updateMany({
      data: { isActive: false }
    });
    
    // Aktifkan yang dipilih
    const year = await prisma.academicYear.update({
      where: { id },
      data: { isActive: true }
    });
    
    successResponse(res, year, 'Tahun ajaran aktif berhasil diubah');
  } catch (err) {
    errorResponse(res, err.message, 500);
  }
};

exports.remove = async (req, res) => {
  try {
    await prisma.academicYear.delete({ where: { id: req.params.id } });
    successResponse(res, null, 'Tahun ajaran berhasil dihapus');
  } catch (err) {
    errorResponse(res, 'Gagal menghapus tahun ajaran. Pastikan tidak ada data pendaftar pada tahun ini.', 500);
  }
};
