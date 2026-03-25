// src/controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');
const { updatePasswordCache } = require('../middleware/auth');

/**
 * Buat JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * POST /api/auth/login
 * Login untuk User (Admin, Guru, Karyawan)
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 'Email dan password wajib diisi.', 400);
    }

    // Cari user atau parent (pendaftar PPDB)
    let account = await prisma.user.findUnique({ where: { email } });
    let accountType = 'user';

    if (!account) {
      account = await prisma.parent.findUnique({ where: { email } });
      accountType = 'parent';
    }

    if (!account) {
      return errorResponse(res, 'Email atau password salah.', 401);
    }

    if (accountType === 'user' && !account.isActive) {
      return errorResponse(res, 'Akun Anda dinonaktifkan. Hubungi Administrator.', 403);
    }

    const isPasswordValid = await bcrypt.compare(password, account.password);
    if (!isPasswordValid) {
      return errorResponse(res, 'Email atau password salah.', 401);
    }

    const tokenPayload = {
      id: account.id,
      email: account.email,
      name: account.name,
      role: accountType === 'user' ? account.role : 'PARENT',
      type: accountType,
      pwdChangedAt: account.passwordChangedAt ? account.passwordChangedAt.getTime() : null,
    };

    const token = generateToken(tokenPayload);

    return successResponse(res, {
      token,
      user: {
        id: account.id,
        name: account.name,
        email: account.email,
        role: accountType === 'user' ? account.role : 'PARENT',
      },
    }, 'Login berhasil.');
  } catch (error) {
    console.error('[Auth/Login]', error);
    return errorResponse(res, 'Terjadi kesalahan server.', 500, error);
  }
};

/**
 * POST /api/auth/register-parent
 * Registrasi akun orang tua / wali murid untuk keperluan PPDB
 */
exports.registerParent = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return errorResponse(res, 'Nama, email, nomor HP, dan password wajib diisi.', 400);
    }

    const exists = await prisma.parent.findUnique({ where: { email } });
    if (exists) {
      return errorResponse(res, 'Email sudah terdaftar.', 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const parent = await prisma.parent.create({
      data: { name, email, phone, password: hashedPassword },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    });

    const token = generateToken({
      id: parent.id,
      email: parent.email,
      name: parent.name,
      role: 'PARENT',
      type: 'parent',
      pwdChangedAt: null, // Baru terdaftar, belum pernah ubah password
    });

    return successResponse(res, { token, user: parent }, 'Pendaftaran akun berhasil.', 201);
  } catch (error) {
    console.error('[Auth/RegisterParent]', error);
    return errorResponse(res, 'Terjadi kesalahan server.', 500, error);
  }
};

/**
 * PUT /api/auth/change-password
 * Mengubah password user yang sedang login (User atau Parent)
 */
exports.changePassword = async (req, res) => {
  try {
    const { id, type } = req.user;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return errorResponse(res, 'Password lama dan password baru wajib diisi.', 400);
    }

    if (newPassword.length < 8) {
      return errorResponse(res, 'Password baru minimal 8 karakter.', 400);
    }

    // Ambil akun berdasarkan tipe (user atau parent)
    let account;
    if (type === 'parent') {
      account = await prisma.parent.findUnique({ where: { id } });
    } else {
      account = await prisma.user.findUnique({ where: { id } });
    }

    if (!account) {
      return errorResponse(res, 'Akun tidak ditemukan.', 404);
    }

    // Verifikasi password lama
    const isOldPasswordValid = await bcrypt.compare(oldPassword, account.password);
    if (!isOldPasswordValid) {
      return errorResponse(res, 'Password lama salah.', 401);
    }

    // Cek setelah verifikasi agar user tidak mendapat info "sama" sebelum membuktikan password lama
    if (oldPassword === newPassword) {
      return errorResponse(res, 'Password baru tidak boleh sama dengan password lama.', 400);
    }

    // Hash password baru
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password dan catat waktu perubahan
    const now = new Date();
    if (type === 'parent') {
      await prisma.parent.update({ where: { id }, data: { password: hashedNewPassword, passwordChangedAt: now } });
    } else {
      await prisma.user.update({ where: { id }, data: { password: hashedNewPassword, passwordChangedAt: now } });
    }

    // Update cache agar request berikutnya langsung mendeteksi perubahan password tanpa race condition
    updatePasswordCache(id, now.getTime());

    return successResponse(res, { requireRelogin: true }, 'Password berhasil diubah. Silakan login ulang.');
  } catch (error) {
    console.error('[Auth/ChangePassword]', error);
    return errorResponse(res, 'Terjadi kesalahan server.', 500, error);
  }
};

/**
 * GET /api/auth/me
 * Mendapatkan data user yang sedang login (dari token)
 */
exports.getMe = async (req, res) => {
  try {
    const { id, type } = req.user;
    let account;

    if (type === 'parent') {
      account = await prisma.parent.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, phone: true },
      });
      if (account) account.role = 'PARENT';
    } else {
      account = await prisma.user.findUnique({
        where: { id },
        select: {
          id: true, name: true, email: true, role: true, isActive: true,
          employee: {
            select: { position: true, department: true, nip: true }
          },
        },
      });
    }

    if (!account) {
      return errorResponse(res, 'Akun tidak ditemukan.', 404);
    }

    return successResponse(res, account, 'Data user berhasil diambil.');
  } catch (error) {
    console.error('[Auth/GetMe]', error);
    return errorResponse(res, 'Terjadi kesalahan server.', 500, error);
  }
};
