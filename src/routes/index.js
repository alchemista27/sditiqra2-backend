// src/routes/index.js - API Router utama
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const cmsRoutes = require('./cms.routes');
const ppdbRoutes = require('./ppdb.routes');
const attendanceRoutes = require('./attendance.routes');

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API SD IT Iqra 2 Bengkulu berjalan dengan baik.',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/cms', cmsRoutes);
router.use('/ppdb', ppdbRoutes);
router.use('/attendance', attendanceRoutes);

module.exports = router;
