// src/middleware/auth.js - JWT Auth Middleware
const jwt = require('jsonwebtoken');

/**
 * Middleware untuk verifikasi JWT token di header Authorization.
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

module.exports = { authenticate, authorize };
