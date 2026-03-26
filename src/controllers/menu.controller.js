// src/controllers/menu.controller.js
// Mengelola Menu Navigasi (MenuItem)
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * GET /api/cms/menu
 * Publik — tampilkan semua menu yang isActive=true, diurutkan by order
 */
exports.getAll = async (req, res) => {
  try {
    const isAdmin = req.user && ['SUPER_ADMIN', 'ADMIN_HUMAS'].includes(req.user.role);

    // Ambil semua root menu (parentId null) beserta children-nya
    const menus = await prisma.menuItem.findMany({
      where: isAdmin ? { parentId: null } : { isActive: true, parentId: null },
      orderBy: { order: 'asc' },
      include: {
        children: {
          orderBy: { order: 'asc' },
          where: isAdmin ? undefined : { isActive: true },
        }
      }
    });
    return successResponse(res, menus);
  } catch (error) {
    return errorResponse(res, 'Gagal mengambil menu navigasi.', 500, error);
  }
};

/**
 * POST /api/cms/menu (Admin only)
 * Tambah menu item baru
 * Body: { label, url, order?, isActive?, openInNewTab? }
 */
exports.create = async (req, res) => {
  try {
    const { label, url, order, isActive = true, openInNewTab = false, parentId = null } = req.body;
    if (!label || !url) return errorResponse(res, 'Label dan URL wajib diisi.', 400);

    // Auto-set order ke paling akhir jika tidak disertakan
    let finalOrder = order;
    if (finalOrder === undefined || finalOrder === null) {
      const last = await prisma.menuItem.findFirst({ 
        where: { parentId },
        orderBy: { order: 'desc' } 
      });
      finalOrder = last ? last.order + 1 : 0;
    }

    const item = await prisma.menuItem.create({
      data: {
        label,
        url,
        order: Number(finalOrder),
        isActive: Boolean(isActive),
        openInNewTab: Boolean(openInNewTab),
        parentId: parentId || null,
      },
    });
    return successResponse(res, item, 'Menu item berhasil ditambahkan.', 201);
  } catch (error) {
    return errorResponse(res, 'Gagal menambah menu item.', 500, error);
  }
};

/**
 * PUT /api/cms/menu/:id (Admin only)
 * Update satu menu item
 */
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, url, order, isActive, openInNewTab, parentId } = req.body;

    const current = await prisma.menuItem.findUnique({ where: { id } });
    if (!current) return errorResponse(res, 'Menu item tidak ditemukan.', 404);

    const updated = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(label !== undefined && { label }),
        ...(url !== undefined && { url }),
        ...(order !== undefined && { order: Number(order) }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(openInNewTab !== undefined && { openInNewTab: Boolean(openInNewTab) }),
        ...(parentId !== undefined && { parentId: parentId || null }),
      },
    });
    return successResponse(res, updated, 'Menu item berhasil diperbarui.');
  } catch (error) {
    if (error.code === 'P2025') return errorResponse(res, 'Menu item tidak ditemukan.', 404);
    return errorResponse(res, 'Gagal memperbarui menu item.', 500, error);
  }
};

/**
 * DELETE /api/cms/menu/:id (Admin only)
 */
exports.remove = async (req, res) => {
  try {
    await prisma.menuItem.delete({ where: { id: req.params.id } });
    return successResponse(res, null, 'Menu item berhasil dihapus.');
  } catch (error) {
    if (error.code === 'P2025') return errorResponse(res, 'Menu item tidak ditemukan.', 404);
    return errorResponse(res, 'Gagal menghapus menu item.', 500, error);
  }
};

/**
 * PUT /api/cms/menu/reorder (Admin only)
 * Simpan urutan baru setelah drag-and-drop hierarchy
 * Body: { items: [{ id, order, parentId: id | null }, ...] }
 */
exports.reorder = async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items)) return errorResponse(res, 'items harus berupa array.', 400);

    // Update order dan parentId setiap item dalam satu transaksi
    const operations = items.map(({ id, order, parentId }) =>
      prisma.menuItem.update({
        where: { id },
        data: { 
          order: Number(order),
          parentId: parentId || null 
        },
      })
    );

    await prisma.$transaction(operations);

    const updated = await prisma.menuItem.findMany({ orderBy: { order: 'asc' } });
    return successResponse(res, updated, 'Urutan menu berhasil disimpan.');
  } catch (error) {
    return errorResponse(res, 'Gagal menyimpan urutan menu.', 500, error);
  }
};
