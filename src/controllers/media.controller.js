// src/controllers/media.controller.js - Cloudinary Media Library
const { cloudinary } = require('../utils/cloudinary');
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * POST /api/cms/media - Upload satu file ke Cloudinary
 * Menggunakan multer memoryStorage untuk piping ke Cloudinary stream
 */
exports.upload = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'Tidak ada file yang diupload.', 400);

    const result = await new Promise((resolve, reject) => {
      const folder = req.body.folder || 'media';
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `sditiqra2/${folder}`,
          resource_type: 'auto',
          transformation: req.file.mimetype.startsWith('image/')
            ? [{ quality: 'auto', fetch_format: 'auto' }]
            : undefined,
        },
        (error, result) => { if (error) reject(error); else resolve(result); }
      );
      stream.end(req.file.buffer);
    });

    // Juga simpan ke database Media untuk history
    const media = await prisma.media.create({
      data: {
        filename: result.public_id,
        originalName: req.file.originalname,
        path: result.public_id,
        url: result.secure_url,
        mimeType: req.file.mimetype,
        size: req.file.size,
        cloudinaryId: result.public_id,
        cloudinaryUrl: result.secure_url,
        uploadedById: req.user.id,
      },
    });

    return successResponse(res, {
      id: media.id,
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height,
      bytes: result.bytes,
    }, 'File berhasil diupload.', 201);
  } catch (error) {
    return errorResponse(res, 'Gagal mengupload file.', 500, error);
  }
};

/**
 * GET /api/cms/media?folder=media&page=1&limit=30
 * Mengambil resource langsung dari Cloudinary API
 */
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 30, folder } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // Selalu query DB dulu — filter berdasarkan role uploader
    const allowedRoles = ['SUPER_ADMIN', 'ADMIN_HUMAS'];
    const where = {
      uploadedBy: { role: { in: allowedRoles } },
      ...(folder ? { path: { startsWith: `sditiqra2/${folder}` } } : {}),
    };

    const [total, media] = await Promise.all([
      prisma.media.count({ where }),
      prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
        include: {
          uploadedBy: { select: { name: true, role: true } },
        },
      }),
    ]);

    const items = media.map(m => ({
      id: m.id,
      publicId: m.cloudinaryId || m.path,
      url: m.cloudinaryUrl || m.url,
      originalName: m.originalName,
      mimeType: m.mimeType,
      bytes: m.size,
      createdAt: m.createdAt,
      uploadedBy: m.uploadedBy?.name || null,
      displayName: m.originalName || m.cloudinaryId?.split('/').pop(),
    }));

    return res.json({
      success: true,
      data: items,
      pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    return errorResponse(res, 'Gagal mengambil media.', 500, error);
  }
};


/**
 * GET /api/cms/media/folders — daftar folder
 */
exports.getFolders = async (req, res) => {
  try {
    const result = await cloudinary.api.sub_folders('sditiqra2');
    return successResponse(res, result.folders || []);
  } catch (error) {
    return successResponse(res, []);
  }
};

/**
 * DELETE /api/cms/media?id=sditiqra2/folder/public_id — hapus dari Cloudinary + DB
 * Menggunakan query param karena publicId bisa mengandung slash
 */
exports.remove = async (req, res) => {
  try {
    const publicId = req.query.id || req.body.publicId;
    if (!publicId) return errorResponse(res, 'publicId wajib disertakan.', 400);

    await cloudinary.uploader.destroy(publicId).catch(() => {});

    // Hapus dari DB jika ada
    await prisma.media.deleteMany({ where: { cloudinaryId: publicId } }).catch(() => {});

    return successResponse(res, null, 'Media berhasil dihapus.');
  } catch (error) {
    return errorResponse(res, 'Gagal menghapus media.', 500, error);
  }
};
