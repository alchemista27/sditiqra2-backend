// src/middleware/auth.js - JWT Auth Middleware
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// ─── In-memory cache for passwordChangedAt ──────────────────────────────
// Avoids a DB query on every authenticated request. Entries expire after
// CACHE_TTL_MS so password changes are detected within a short window.
const PWD_CHANGED_CACHE = new Map(); // key: userId, value: { ts: number|null, expiresAt: number }
const CACHE_TTL_MS = parseInt(process.env.PASSWORD_CACHE_TTL_MS, 10) || 30_000; // 30 seconds

// Cleanup expired entries every 2 minutes
const _cacheCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of PWD_CHANGED_CACHE) {
    if (now > val.expiresAt) PWD_CHANGED_CACHE.delete(key);
  }
}, 2 * 60 * 1000);
_cacheCleanup.unref();

/**
 * Mendapatkan passwordChangedAt dari cache atau DB.
 * Mengembalikan { ts: number|null } atau { notFound: true }.
 */
async function getPasswordChangedAt(userId, type) {
  const cached = PWD_CHANGED_CACHE.get(userId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.notFound ? { notFound: true } : { ts: cached.ts };
  }

  const model = type === 'parent' ? prisma.parent : prisma.user;
  const account = await model.findUnique({
    where: { id: userId },
    select: { passwordChangedAt: true },
  });

  if (!account) {
    PWD_CHANGED_CACHE.set(userId, { notFound: true, expiresAt: Date.now() + CACHE_TTL_MS });
    return { notFound: true };
  }

  const ts = account.passwordChangedAt ? account.passwordChangedAt.getTime() : null;
  PWD_CHANGED_CACHE.set(userId, { ts, expiresAt: Date.now() + CACHE_TTL_MS });
  return { ts };
}

/**
 * Memperbarui cache untuk user tertentu (dipanggil setelah password diubah).
 * Prevents race conditions during rapid password changes.
 * @param {string} userId
 * @param {number} ts - Timestamp of password change
 */
function updatePasswordCache(userId, ts) {
  PWD_CHANGED_CACHE.set(userId, { ts, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Helper: Periksa apakah password telah diubah setelah token diterbitkan.
 * Mengembalikan { error: null } jika valid, atau { error: string } jika tidak.
 *
 * Menggunakan in-memory cache (TTL 30 detik) untuk menghindari DB query pada
 * setiap request. Buffer 2 detik untuk mengatasi perbedaan presisi antara
 * JWT `iat` (detik) dan `passwordChangedAt` (milidetik), serta potensi clock skew.
 *
 * @param {object} decoded - JWT decoded payload (harus memiliki id, type, iat)
 * @returns {Promise<{ error: string|null, code?: string, status?: number }>}
 */
async function checkPasswordChanged(decoded) {
  const BUFFER_MS = 2000; // 2-second buffer for precision & clock skew

  const result = await getPasswordChangedAt(decoded.id, decoded.type);

  if (result.notFound) {
    return {
      error: 'Akun tidak ditemukan atau telah dihapus.',
      code: 'ACCOUNT_NOT_FOUND',
      status: 401,
    };
  }

  const tokenIssuedAtMs = decoded.iat * 1000;
  if (result.ts && result.ts > tokenIssuedAtMs + BUFFER_MS) {
    return {
      error: 'Password telah diubah. Silakan login ulang.',
      code: 'PASSWORD_CHANGED',
      status: 401,
    };
  }

  return { error: null };
}

/**
 * Middleware untuk verifikasi JWT token di header Authorization.
 * Berlaku untuk User (admin/karyawan) MAUPUN Parent (orang tua PPDB).
 * Token payload berisi: { id, email, name, role, type, iat }
 *
 * Memeriksa apakah password telah diubah setelah token diterbitkan (via iat claim).
 * Jika ya, token dianggap tidak valid dan user harus login ulang.
 */
const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Token tidak ditemukan.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Periksa apakah password telah diubah setelah token diterbitkan
    const check = await checkPasswordChanged(decoded);
    if (check.error) {
      return res.status(check.status).json({
        success: false,
        message: check.error,
        code: check.code,
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Sesi login telah berakhir. Silakan login ulang.' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Token tidak valid. Silakan login ulang.' });
    }
    console.error('[Auth Middleware Error]:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan verifikasi sesi. Kemungkinan password baru saja diubah dari perangkat lain. Silakan login ulang.' });
  }
};

/**
 * Middleware untuk membatasi akses berdasarkan Role.
 * Penggunaan: authorize('SUPER_ADMIN', 'ADMIN_CMS')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Anda tidak memiliki izin.' });
    }
    next();
  };
};

/**
 * Middleware khusus untuk memproteksi route portal orang tua PPDB.
 * Hanya mengizinkan token dengan type: 'parent' (model Parent).
 * Menggunakan req.parent (bukan req.user) agar tidak konflik dengan admin.
 */
const authenticateParent = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Silakan login terlebih dahulu.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'parent') {
      return res.status(403).json({ success: false, message: 'Akses ditolak. Endpoint ini hanya untuk orang tua pendaftar.' });
    }

    // Periksa apakah password telah diubah setelah token diterbitkan
    const check = await checkPasswordChanged(decoded);
    if (check.error) {
      return res.status(check.status).json({
        success: false,
        message: check.error,
        code: check.code,
      });
    }

    req.parent = decoded; // Attach ke req.parent (bukan req.user)
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Sesi login telah berakhir. Silakan login ulang.' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Token tidak valid. Silakan login ulang.' });
    }
    console.error('[AuthParent Middleware Error]:', err);
    return res.status(500).json({ success: false, message: 'Terjadi kesalahan verifikasi sesi. Kemungkinan password baru saja diubah dari perangkat lain. Silakan login ulang.' });
  }
};

module.exports = { authenticate, authorize, authenticateParent, updatePasswordCache };
