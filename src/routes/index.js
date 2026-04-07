// src/routes/index.js - API Router utama
const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const cmsRoutes = require('./cms.routes');
const ppdbRoutes = require('./ppdb.routes');
const attendanceRoutes = require('./attendance.routes');
const holidayRoutes = require('./holiday.routes');
const leaveRoutes = require('./leave.routes');
const reportRoutes = require('./report.routes');
const userRoutes = require('./user.routes');

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
router.use('/holidays', holidayRoutes);
router.use('/leaves', leaveRoutes);
router.use('/reports', reportRoutes);
router.use('/users', userRoutes);

module.exports = router;

