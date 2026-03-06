// src/middleware/auth.js - JWT Auth Middleware
const jwt = require('jsonwebtoken');

/**
 * Middleware untuk verifikasi JWT token di header Authorization.
 * Berlaku untuk User (admin/karyawan) MAUPUN Parent (orang tua PPDB).
 * Token payload berisi: { id, email, name, role, type }
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

  if (!token) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Token tidak ditemukan.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Token tidak valid atau sudah kadaluarsa.' });
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
const authenticateParent = (req, res, next) => {
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

    req.parent = decoded; // Attach ke req.parent (bukan req.user)
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Token tidak valid atau sudah kadaluarsa.' });
  }
};

module.exports = { authenticate, authorize, authenticateParent };
