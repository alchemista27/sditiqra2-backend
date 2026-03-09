// src/controllers/settings.controller.js
// Mengelola Site Settings (key-value store untuk konfigurasi situs)
const prisma = require('../lib/prisma');
const { cloudinary } = require('../utils/cloudinary');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * GET /api/cms/settings
 * Publik — mengembalikan semua settings sebagai satu objek { key: value, ... }
 */
exports.getAll = async (req, res) => {
  try {
    const rows = await prisma.siteSetting.findMany();
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    return successResponse(res, settings);
  } catch (error) {
    return errorResponse(res, 'Gagal mengambil pengaturan situs.', 500, error);
  }
};

/**
 * GET /api/cms/settings/:key
 */
exports.getOne = async (req, res) => {
  try {
    const setting = await prisma.siteSetting.findUnique({
      where: { key: req.params.key },
    });
    if (!setting) return errorResponse(res, 'Setting tidak ditemukan.', 404);
    return successResponse(res, setting);
  } catch (error) {
    return errorResponse(res, 'Gagal mengambil setting.', 500, error);
  }
};

/**
 * PUT /api/cms/settings (Admin only)
 * Body: { key: value, key2: value2, ... }
 */
exports.updateMany = async (req, res) => {
  try {
    const updates = req.body;
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return errorResponse(res, 'Body harus berupa objek { key: value, ... }', 400);
    }

    const operations = Object.entries(updates).map(([key, value]) =>
      prisma.siteSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );

    await prisma.$transaction(operations);

    const rows = await prisma.siteSetting.findMany();
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    return successResponse(res, settings, 'Pengaturan berhasil disimpan.');
  } catch (error) {
    return errorResponse(res, 'Gagal menyimpan pengaturan.', 500, error);
  }
};

/**
 * Upload file ke Cloudinary via buffer stream
 */
async function uploadToCloudinary(buffer, folder, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `sditiqra2/${folder}`,
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => { if (error) reject(error); else resolve(result); }
    );
    stream.end(buffer);
  });
}

/**
 * POST /api/cms/settings/upload-logo (Admin only)
 * Upload logo ke Cloudinary — URL Cloudinary disimpan ke SiteSetting
 */
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'File logo wajib diupload.', 400);

    let logoUrl;

    // Jika sudah ada Cloudinary URL dari multer-storage-cloudinary
    if (req.file.path?.startsWith('http')) {
      logoUrl = req.file.path;
    } else if (req.file.buffer) {
      // Upload via stream (memoryStorage)
      const result = await uploadToCloudinary(req.file.buffer, 'settings', 'site_logo');
      logoUrl = result.secure_url;
    } else {
      // Fallback: path lokal (hanya jika tidak ada koneksi Cloudinary)
      logoUrl = `/uploads/settings/${req.file.filename}`;
    }

    await prisma.siteSetting.upsert({
      where: { key: 'site_logo' },
      update: { value: logoUrl },
      create: { key: 'site_logo', value: logoUrl },
    });

    return successResponse(res, { url: logoUrl }, 'Logo berhasil diupload.');
  } catch (error) {
    return errorResponse(res, 'Gagal mengupload logo.', 500, error);
  }
};

/**
 * POST /api/cms/settings/upload-favicon (Admin only)
 */
exports.uploadFavicon = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 'File favicon wajib diupload.', 400);

    let faviconUrl;

    if (req.file.path?.startsWith('http')) {
      faviconUrl = req.file.path;
    } else if (req.file.buffer) {
      const result = await uploadToCloudinary(req.file.buffer, 'settings', 'site_favicon');
      faviconUrl = result.secure_url;
    } else {
      faviconUrl = `/uploads/settings/${req.file.filename}`;
    }

    await prisma.siteSetting.upsert({
      where: { key: 'site_favicon' },
      update: { value: faviconUrl },
      create: { key: 'site_favicon', value: faviconUrl },
    });

    return successResponse(res, { url: faviconUrl }, 'Favicon berhasil diupload.');
  } catch (error) {
    return errorResponse(res, 'Gagal mengupload favicon.', 500, error);
  }
};
