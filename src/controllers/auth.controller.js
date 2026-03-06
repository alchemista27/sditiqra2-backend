// src/controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');

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
    });

    return successResponse(res, { token, user: parent }, 'Pendaftaran akun berhasil.', 201);
  } catch (error) {
    console.error('[Auth/RegisterParent]', error);
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
