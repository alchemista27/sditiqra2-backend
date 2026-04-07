// src/controllers/user.controller.js - User Management Controller
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');
const bcrypt = require('bcryptjs');

// GET /api/users - Get all users (super admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return successResponse(res, users, 'Data user berhasil diambil.');
  } catch (error) {
    console.error('Error getting users:', error);
    return errorResponse(res, 'Gagal mengambil data user.');
  }
};

// GET /api/users/:id - Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) {
      return errorResponse(res, 'User tidak ditemukan.', 404);
    }
    return successResponse(res, user, 'Data user berhasil diambil.');
  } catch (error) {
    console.error('Error getting user:', error);
    return errorResponse(res, 'Gagal mengambil data user.');
  }
};

// PUT /api/users/:id - Update user (name, role, isActive)
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, isActive } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return errorResponse(res, 'User tidak ditemukan.', 404);
    }

    // Check if trying to update own account
    if (id === req.user.id) {
      return errorResponse(res, 'Tidak dapat mengubah akun sendiri.', 400);
    }

    // Build update data
    const updateData = {};
    if (name) updateData.name = name;
    if (role) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return successResponse(res, updatedUser, 'User berhasil diperbarui.');
  } catch (error) {
    console.error('Error updating user:', error);
    return errorResponse(res, 'Gagal memperbarui user.');
  }
};

// PUT /api/users/:id/password - Reset user password (super admin only)
exports.resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return errorResponse(res, 'Password baru minimal 6 karakter.');
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return errorResponse(res, 'User tidak ditemukan.', 404);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword, passwordChangedAt: new Date() },
    });

    return successResponse(res, null, 'Password berhasil direset.');
  } catch (error) {
    console.error('Error resetting password:', error);
    return errorResponse(res, 'Gagal mereset password.');
  }
};

// POST /api/users - Create new user (super admin only)
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return errorResponse(res, 'Nama, email, dan password wajib diisi.');
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return errorResponse(res, 'Email sudah terdaftar.');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'KARYAWAN',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    return successResponse(res, newUser, 'User berhasil dibuat.', 201);
  } catch (error) {
    console.error('Error creating user:', error);
    return errorResponse(res, 'Gagal membuat user.');
  }
};

// DELETE /api/users/:id - Delete user (super admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return errorResponse(res, 'User tidak ditemukan.', 404);
    }

    // Check if trying to delete own account
    if (id === req.user.id) {
      return errorResponse(res, 'Tidak dapat menghapus akun sendiri.', 400);
    }

    await prisma.user.delete({ where: { id } });

    return successResponse(res, null, 'User berhasil dihapus.');
  } catch (error) {
    console.error('Error deleting user:', error);
    return errorResponse(res, 'Gagal menghapus user.');
  }
};