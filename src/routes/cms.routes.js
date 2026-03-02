// src/routes/cms.routes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

const postController = require('../controllers/post.controller');
const pageController = require('../controllers/page.controller');
const categoryController = require('../controllers/category.controller');
const mediaController = require('../controllers/media.controller');

const cmsAdmin = ['SUPER_ADMIN', 'ADMIN_CMS'];

// ─── POSTS (Berita/Pengumuman) ────────────────────────────────
// Publik (tanpa token) – hanya tampilkan PUBLISHED
router.get('/posts', postController.getAll);
router.get('/posts/:slug', postController.getBySlug);

// Admin only
router.post('/posts', authenticate, authorize(...cmsAdmin), upload.single('coverImage'), postController.create);
router.put('/posts/:id', authenticate, authorize(...cmsAdmin), upload.single('coverImage'), postController.update);
router.delete('/posts/:id', authenticate, authorize(...cmsAdmin), postController.remove);

// ─── PAGES (Halaman Statis) ───────────────────────────────────
router.get('/pages', pageController.getAll);
router.get('/pages/:slug', pageController.getBySlug);

router.post('/pages', authenticate, authorize(...cmsAdmin), pageController.create);
router.put('/pages/:id', authenticate, authorize(...cmsAdmin), pageController.update);
router.delete('/pages/:id', authenticate, authorize(...cmsAdmin), pageController.remove);

// ─── CATEGORIES ───────────────────────────────────────────────
router.get('/categories', categoryController.getAll);
router.post('/categories', authenticate, authorize(...cmsAdmin), categoryController.create);
router.put('/categories/:id', authenticate, authorize(...cmsAdmin), categoryController.update);
router.delete('/categories/:id', authenticate, authorize(...cmsAdmin), categoryController.remove);

// ─── MEDIA ───────────────────────────────────────────────────
router.get('/media', authenticate, authorize(...cmsAdmin), mediaController.getAll);
router.post('/media', authenticate, authorize(...cmsAdmin), upload.array('files', 10), mediaController.upload);
router.delete('/media/:id', authenticate, authorize(...cmsAdmin), mediaController.remove);

module.exports = router;
