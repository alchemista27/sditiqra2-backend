// src/controllers/gallery.controller.js
const prisma = require('../lib/prisma');
const { cloudinary } = require('../utils/cloudinary');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * GET /api/cms/gallery — publik, ambil semua galeri aktif
 */
exports.getAll = async (req, res) => {
  try {
    const isAdmin = req.user && ['SUPER_ADMIN', 'ADMIN_CMS'].includes(req.user.role);
    const items = await prisma.galleryItem.findMany({
      where: isAdmin ? {} : { isActive: true },
      orderBy: { order: 'asc' },
    });
    return successResponse(res, items);
  } catch (error) {
    return errorResponse(res, 'Gagal mengambil data galeri.', 500, error);
  }
};

/**
 * POST /api/cms/gallery — upload + tambah item baru
 * Gunakan multipart: field 'image' + field 'title', 'description', 'order'
 */
exports.create = async (req, res) => {
  try {
    const { title, description, order = 0 } = req.body;
    if (!title) return errorResponse(res, 'Judul wajib diisi.', 400);

    let imageUrl = '';
    let cloudinaryId = null;

    if (req.file) {
      // Upload via stream ke Cloudinary
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'sditiqra2/gallery', resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
          (error, result) => { if (error) reject(error); else resolve(result); }
        );
        stream.end(req.file.buffer);
      });
      imageUrl = result.secure_url;
      cloudinaryId = result.public_id;
    } else if (req.body.imageUrl) {
      imageUrl = req.body.imageUrl;
    } else {
      return errorResponse(res, 'Gambar atau URL gambar wajib disertakan.', 400);
    }

    const item = await prisma.galleryItem.create({
      data: {
        title,
        description: description || null,
        imageUrl,
        cloudinaryId,
        order: Number(order),
        isActive: true,
      },
    });
    return successResponse(res, item, 'Item galeri berhasil ditambahkan.', 201);
  } catch (error) {
    return errorResponse(res, 'Gagal menambahkan item galeri.', 500, error);
  }
};

/**
 * PUT /api/cms/gallery/:id — update item (termasuk opsional ganti gambar)
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, order, isActive } = req.body;

    const current = await prisma.galleryItem.findUnique({ where: { id } });
    if (!current) return errorResponse(res, 'Item tidak ditemukan.', 404);

    let imageUrl = current.imageUrl;
    let cloudinaryId = current.cloudinaryId;

    if (req.file) {
      // Hapus gambar lama dari Cloudinary jika ada
      if (current.cloudinaryId) {
        await cloudinary.uploader.destroy(current.cloudinaryId).catch(() => {});
      }
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'sditiqra2/gallery', resource_type: 'image', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
          (error, result) => { if (error) reject(error); else resolve(result); }
        );
        stream.end(req.file.buffer);
      });
      imageUrl = result.secure_url;
      cloudinaryId = result.public_id;
    } else if (req.body.imageUrl && req.body.imageUrl !== current.imageUrl) {
      imageUrl = req.body.imageUrl;
      cloudinaryId = null;
    }

    const updated = await prisma.galleryItem.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(order !== undefined && { order: Number(order) }),
        ...(isActive !== undefined && { isActive: isActive === 'true' || isActive === true }),
        imageUrl,
        cloudinaryId,
      },
    });
    return successResponse(res, updated, 'Item galeri berhasil diperbarui.');
  } catch (error) {
    return errorResponse(res, 'Gagal memperbarui item galeri.', 500, error);
  }
};

/**
 * PUT /api/cms/gallery/reorder — simpan ulang urutan
 * Body: { items: [{ id, order }, ...] }
 */
exports.reorder = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return errorResponse(res, 'items harus array.', 400);
    const ops = items.map(({ id, order }) =>
      prisma.galleryItem.update({ where: { id }, data: { order: Number(order) } })
    );
    await prisma.$transaction(ops);
    return successResponse(res, null, 'Urutan galeri berhasil disimpan.');
  } catch (error) {
    return errorResponse(res, 'Gagal menyimpan urutan.', 500, error);
  }
};

/**
 * DELETE /api/cms/gallery/:id — hapus item dan gambar Cloudinary-nya
 */
exports.remove = async (req, res) => {
  try {
    const item = await prisma.galleryItem.findUnique({ where: { id: req.params.id } });
    if (!item) return errorResponse(res, 'Item tidak ditemukan.', 404);

    if (item.cloudinaryId) {
      await cloudinary.uploader.destroy(item.cloudinaryId).catch(() => {});
    }
    await prisma.galleryItem.delete({ where: { id: item.id } });
    return successResponse(res, null, 'Item galeri berhasil dihapus.');
  } catch (error) {
    return errorResponse(res, 'Gagal menghapus item galeri.', 500, error);
  }
};
