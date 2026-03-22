// src/controllers/page.controller.js
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');
const slugify = require('../utils/slugify');

/**
 * GET /api/cms/pages - Semua halaman (publik hanya PUBLISHED)
 */
exports.getAll = async (req, res) => {
  try {
    const isAdmin = req.user && ['SUPER_ADMIN', 'ADMIN_CMS'].includes(req.user.role);
    const pages = await prisma.page.findMany({
      where: isAdmin ? {} : { status: 'PUBLISHED' },
      select: { id: true, title: true, slug: true, status: true, sortOrder: true, updatedAt: true },
      orderBy: { sortOrder: 'asc' },
    });
    return successResponse(res, pages);
  } catch (error) {
    return errorResponse(res, 'Gagal mengambil data halaman.', 500, error);
  }
};

/**
 * GET /api/cms/pages/:slugOrId
 * Supports both slug and ID lookup
 */
exports.getBySlug = async (req, res) => {
  try {
    const isAdmin = req.user && ['SUPER_ADMIN', 'ADMIN_CMS'].includes(req.user.role);
    const { slug } = req.params;
    
    // Try to find by slug first, then by ID
    let page = await prisma.page.findUnique({
      where: { slug },
      include: { author: { select: { id: true, name: true } } },
    });
    
    // If not found by slug, try by ID (for admin edit pages)
    if (!page) {
      page = await prisma.page.findUnique({
        where: { id: slug },
        include: { author: { select: { id: true, name: true } } },
      });
    }

    if (!page) return errorResponse(res, 'Halaman tidak ditemukan.', 404);
    if (!isAdmin && page.status !== 'PUBLISHED') return errorResponse(res, 'Halaman tidak ditemukan.', 404);

    return successResponse(res, page);
  } catch (error) {
    return errorResponse(res, 'Gagal mengambil halaman.', 500, error);
  }
};

/**
 * POST /api/cms/pages (Admin only)
 */
exports.create = async (req, res) => {
  try {
    const { title, content, status = 'DRAFT', sortOrder = 0 } = req.body;
    if (!title || !content) return errorResponse(res, 'Judul dan konten wajib diisi.', 400);

    let slug = slugify(title);
    const existing = await prisma.page.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const page = await prisma.page.create({
      data: { title, slug, content, status, sortOrder: Number(sortOrder), authorId: req.user.id },
    });
    return successResponse(res, page, 'Halaman berhasil dibuat.', 201);
  } catch (error) {
    return errorResponse(res, 'Gagal membuat halaman.', 500, error);
  }
};

/**
 * PUT /api/cms/pages/:id (Admin only)
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, status, sortOrder } = req.body;

    const current = await prisma.page.findUnique({ where: { id } });
    if (!current) return errorResponse(res, 'Halaman tidak ditemukan.', 404);

    let slug = current.slug;
    if (title && title !== current.title) {
      slug = slugify(title);
      const existing = await prisma.page.findFirst({ where: { slug, NOT: { id } } });
      if (existing) slug = `${slug}-${Date.now()}`;
    }

    const updated = await prisma.page.update({
      where: { id },
      data: {
        ...(title && { title }), slug,
        ...(content && { content }),
        ...(status && { status }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) }),
      },
    });
    return successResponse(res, updated, 'Halaman berhasil diperbarui.');
  } catch (error) {
    if (error.code === 'P2025') return errorResponse(res, 'Halaman tidak ditemukan.', 404);
    return errorResponse(res, 'Gagal memperbarui halaman.', 500, error);
  }
};

/**
 * DELETE /api/cms/pages/:id (Admin only)
 */
exports.remove = async (req, res) => {
  try {
    await prisma.page.delete({ where: { id: req.params.id } });
    return successResponse(res, null, 'Halaman berhasil dihapus.');
  } catch (error) {
    if (error.code === 'P2025') return errorResponse(res, 'Halaman tidak ditemukan.', 404);
    return errorResponse(res, 'Gagal menghapus halaman.', 500, error);
  }
};
