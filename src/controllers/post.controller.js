// src/controllers/post.controller.js
const prisma = require('../lib/prisma');
const { successResponse, errorResponse, paginatedResponse } = require('../utils/response');
const slugify = require('../utils/slugify');
const { sendToInstagram } = require('../services/makecom.service');

// Helper: data select untuk publik (exclude konten berat dari daftar)
const postListSelect = {
  id: true, title: true, slug: true, excerpt: true,
  coverImage: true, status: true, publishedAt: true, createdAt: true,
  author: { select: { id: true, name: true } },
  category: { select: { id: true, name: true, slug: true } },
};

/**
 * GET /api/cms/posts?page=1&limit=10&status=PUBLISHED&categoryId=...
 * Publik: hanya PUBLISHED. Admin bisa lihat semua status.
 */
exports.getAll = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, categoryId, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const isAdmin = req.user && ['SUPER_ADMIN', 'ADMIN_HUMAS'].includes(req.user.role);

    const where = {
      ...(isAdmin ? (status ? { status } : {}) : { status: 'PUBLISHED' }),
      ...(categoryId && { categoryId }),
      ...(search && { OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
      ]}),
    };

    const [total, posts] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({ where, select: postListSelect, orderBy: { publishedAt: 'desc' }, skip, take: Number(limit) }),
    ]);

    return paginatedResponse(res, posts, {
      page: Number(page), limit: Number(limit),
      total, totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (error) {
    return errorResponse(res, 'Gagal mengambil data berita.', 500, error);
  }
};

/**
 * GET /api/cms/posts/:slugOrId
 * Supports both slug and ID lookup
 */
exports.getBySlug = async (req, res) => {
  try {
    const isAdmin = req.user && ['SUPER_ADMIN', 'ADMIN_HUMAS'].includes(req.user.role);
    const { slug } = req.params;
    
    // Try to find by slug first, then by ID
    let post = await prisma.post.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    
    // If not found by slug, try by ID (for admin edit pages)
    if (!post) {
      post = await prisma.post.findUnique({
        where: { id: slug },
        include: {
          author: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
      });
    }

    if (!post) return errorResponse(res, 'Berita tidak ditemukan.', 404);
    if (!isAdmin && post.status !== 'PUBLISHED') return errorResponse(res, 'Berita tidak ditemukan.', 404);

    return successResponse(res, post);
  } catch (error) {
    return errorResponse(res, 'Gagal mengambil berita.', 500, error);
  }
};

/**
 * POST /api/cms/posts (Admin only)
 */
exports.create = async (req, res) => {
  try {
    const { title, excerpt, content, categoryId, status = 'DRAFT' } = req.body;
    if (!title || !content) return errorResponse(res, 'Judul dan konten wajib diisi.', 400);

    let slug = slugify(title);
    // Pastikan slug unik
    const existing = await prisma.post.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const coverImage = req.file ? `/uploads/cms/${req.file.filename}` : null;
    const publishedAt = status === 'PUBLISHED' ? new Date() : null;

    const post = await prisma.post.create({
      data: {
        title, slug, excerpt, content, coverImage, status, publishedAt,
        authorId: req.user.id,
        ...(categoryId && { categoryId }),
      },
      include: { author: { select: { id: true, name: true } }, category: true },
    });

    if (status === 'PUBLISHED') {
      sendToInstagram(post);
    }

    return successResponse(res, post, 'Berita berhasil dibuat.', 201);
  } catch (error) {
    return errorResponse(res, 'Gagal membuat berita.', 500, error);
  }
};

/**
 * PUT /api/cms/posts/:id (Admin only)
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, excerpt, content, categoryId, status } = req.body;

    const current = await prisma.post.findUnique({ where: { id } });
    if (!current) return errorResponse(res, 'Berita tidak ditemukan.', 404);

    let slug = current.slug;
    if (title && title !== current.title) {
      slug = slugify(title);
      const existing = await prisma.post.findFirst({ where: { slug, NOT: { id } } });
      if (existing) slug = `${slug}-${Date.now()}`;
    }

    const coverImage = req.file ? `/uploads/cms/${req.file.filename}` : current.coverImage;
    const publishedAt = status === 'PUBLISHED' && !current.publishedAt ? new Date() : current.publishedAt;

    const updated = await prisma.post.update({
      where: { id },
      data: {
        ...(title && { title }), slug,
        ...(excerpt !== undefined && { excerpt }),
        ...(content && { content }), coverImage,
        ...(status && { status }), publishedAt,
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
      },
      include: { author: { select: { id: true, name: true } }, category: true },
    });

    if (status === 'PUBLISHED' && current.status !== 'PUBLISHED') {
      sendToInstagram(updated);
    }

    return successResponse(res, updated, 'Berita berhasil diperbarui.');
  } catch (error) {
    return errorResponse(res, 'Gagal memperbarui berita.', 500, error);
  }
};

/**
 * DELETE /api/cms/posts/:id (Admin only)
 */
exports.remove = async (req, res) => {
  try {
    await prisma.post.delete({ where: { id: req.params.id } });
    return successResponse(res, null, 'Berita berhasil dihapus.');
  } catch (error) {
    if (error.code === 'P2025') return errorResponse(res, 'Berita tidak ditemukan.', 404);
    return errorResponse(res, 'Gagal menghapus berita.', 500, error);
  }
};
