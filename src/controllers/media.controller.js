// src/controllers/media.controller.js
const prisma = require('../lib/prisma');
const path = require('path');
const fs = require('fs');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * POST /api/cms/media - Upload satu atau lebih file
 */
exports.upload = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return errorResponse(res, 'Tidak ada file yang diupload.', 400);
    }

    const mediaItems = req.files.map((file) => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      url: `/${file.path.replace(/\\/g, '/')}`,
      mimeType: file.mimetype,
      size: file.size,
      uploadedById: req.user.id,
    }));

    await prisma.media.createMany({ data: mediaItems });

    const created = await prisma.media.findMany({
      where: { filename: { in: mediaItems.map(m => m.filename) } },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(res, created, 'File berhasil diupload.', 201);
  } catch (error) {
    return errorResponse(res, 'Gagal mengupload file.', 500, error);
  }
};

/**
 * GET /api/cms/media?page=1&limit=20
 */
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [total, media] = await Promise.all([
      prisma.media.count(),
      prisma.media.findMany({
        orderBy: { createdAt: 'desc' },
        skip, take: Number(limit),
        include: { uploadedBy: { select: { name: true } } },
      }),
    ]);

    return res.json({
      success: true, data: media,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    return errorResponse(res, 'Gagal mengambil media.', 500, error);
  }
};

/**
 * DELETE /api/cms/media/:id - Hapus file dari disk dan database
 */
exports.remove = async (req, res) => {
  try {
    const media = await prisma.media.findUnique({ where: { id: req.params.id } });
    if (!media) return errorResponse(res, 'Media tidak ditemukan.', 404);

    // Hapus file dari disk
    if (fs.existsSync(media.path)) fs.unlinkSync(media.path);

    await prisma.media.delete({ where: { id: media.id } });
    return successResponse(res, null, 'Media berhasil dihapus.');
  } catch (error) {
    return errorResponse(res, 'Gagal menghapus media.', 500, error);
  }
};
