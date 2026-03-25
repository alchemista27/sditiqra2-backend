// src/middleware/rateLimiter.js - Simple in-memory rate limiter
// Membatasi jumlah request per IP dalam jangka waktu tertentu
//
// NOTE: In-memory store — only effective for single-instance deployments.
// For multi-instance (e.g. Railway scaling, PM2 cluster), use Redis-backed
// rate limiting (e.g. rate-limiter-flexible with Redis store).

/**
 * Membuat middleware rate limiter.
 * @param {Object} options
 * @param {number} options.windowMs - Jangka waktu dalam milidetik (default: 60000 = 1 menit)
 * @param {number} options.max - Jumlah maksimum request per window (default: 5)
 * @param {string} options.message - Pesan error saat limit tercapai
 * @returns {Function} Express middleware
 */
function createRateLimiter({ windowMs = 60000, max = 5, message = 'Terlalu banyak percobaan. Silakan coba lagi nanti.' } = {}) {
  const requests = new Map(); // key: IP or user ID, value: { count, resetTime }

  // Bersihkan entry yang sudah expired setiap 5 menit
  // .unref() agar timer tidak mencegah proses Node.js keluar (penting untuk testing)
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of requests) {
      if (now > value.resetTime) {
        requests.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  cleanupInterval.unref();

  return (req, res, next) => {
    // Gunakan user ID jika sudah terautentikasi, fallback ke IP
    // Jika tidak ada IP (sangat jarang), gunakan key statis 'anonymous' agar
    // semua request tanpa identitas tetap terkena rate limit (shared bucket).
    const key = req.user?.id || req.ip || req.socket?.remoteAddress || 'anonymous';
    const now = Date.now();

    const record = requests.get(key);

    if (!record || now > record.resetTime) {
      // Window baru
      requests.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({
        success: false,
        message,
        retryAfter,
      });
    }

    record.count++;
    return next();
  };
}

module.exports = { createRateLimiter };
