// src/controllers/category.controller.js
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');
const slugify = require('../utils/slugify');

exports.getAll = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { posts: true } } },
    });
    return successResponse(res, categories);
  } catch (error) {
    return errorResponse(res, 'Gagal mengambil data kategori.', 500, error);
  }
};

exports.create = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return errorResponse(res, 'Nama kategori wajib diisi.', 400);

    const slug = slugify(name);
    const exists = await prisma.category.findUnique({ where: { slug } });
    if (exists) return errorResponse(res, 'Kategori dengan nama tersebut sudah ada.', 409);

    const category = await prisma.category.create({ data: { name, slug, description } });
    return successResponse(res, category, 'Kategori berhasil dibuat.', 201);
  } catch (error) {
    return errorResponse(res, 'Gagal membuat kategori.', 500, error);
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const slug = name ? slugify(name) : undefined;

    const category = await prisma.category.update({
      where: { id },
      data: { ...(name && { name }), ...(slug && { slug }), ...(description !== undefined && { description }) },
    });
    return successResponse(res, category, 'Kategori berhasil diperbarui.');
  } catch (error) {
    if (error.code === 'P2025') return errorResponse(res, 'Kategori tidak ditemukan.', 404);
    return errorResponse(res, 'Gagal memperbarui kategori.', 500, error);
  }
};

exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.category.delete({ where: { id } });
    return successResponse(res, null, 'Kategori berhasil dihapus.');
  } catch (error) {
    if (error.code === 'P2025') return errorResponse(res, 'Kategori tidak ditemukan.', 404);
    return errorResponse(res, 'Gagal menghapus kategori.', 500, error);
  }
};
