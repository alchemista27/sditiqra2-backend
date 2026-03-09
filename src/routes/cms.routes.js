// src/routes/cms.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../utils/upload');

// Memory storage untuk upload yang di-stream langsung ke Cloudinary
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|pdf/;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('Tipe file tidak diizinkan.'));
  },
});

const postController = require('../controllers/post.controller');
const pageController = require('../controllers/page.controller');
const categoryController = require('../controllers/category.controller');
const mediaController = require('../controllers/media.controller');
const settingsController = require('../controllers/settings.controller');
const menuController = require('../controllers/menu.controller');
const galleryController = require('../controllers/gallery.controller');

const cmsAdmin = ['SUPER_ADMIN', 'ADMIN_CMS'];

// ─── POSTS (Berita/Pengumuman) ────────────────────────────────
router.get('/posts', postController.getAll);
router.get('/posts/:slug', postController.getBySlug);
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

// ─── GALLERY (Publik + Admin) ─────────────────────────────────
router.get('/gallery', galleryController.getAll); // Publik — untuk homepage slideshow
router.post('/gallery', authenticate, authorize(...cmsAdmin), memUpload.single('image'), galleryController.create);
router.put('/gallery/reorder', authenticate, authorize(...cmsAdmin), galleryController.reorder);
router.put('/gallery/:id', authenticate, authorize(...cmsAdmin), memUpload.single('image'), galleryController.update);
router.delete('/gallery/:id', authenticate, authorize(...cmsAdmin), galleryController.remove);

// ─── MEDIA LIBRARY (Admin — Cloudinary) ──────────────────────
router.get('/media', authenticate, authorize(...cmsAdmin), mediaController.getAll);
router.get('/media/folders', authenticate, authorize(...cmsAdmin), mediaController.getFolders);
router.post('/media', authenticate, authorize(...cmsAdmin), memUpload.single('file'), mediaController.upload);
// DELETE menggunakan body/query karena publicId Cloudinary bisa mengandung slash
router.delete('/media', authenticate, authorize(...cmsAdmin), mediaController.remove);

// ─── SITE SETTINGS ────────────────────────────────────────────
router.get('/settings', settingsController.getAll);
router.get('/settings/:key', settingsController.getOne);
router.put('/settings', authenticate, authorize(...cmsAdmin), settingsController.updateMany);
router.post('/settings/upload-logo',
  authenticate, authorize(...cmsAdmin),
  memUpload.single('logo'),
  settingsController.uploadLogo
);
router.post('/settings/upload-favicon',
  authenticate, authorize(...cmsAdmin),
  memUpload.single('favicon'),
  settingsController.uploadFavicon
);

// ─── MENU NAVIGASI ────────────────────────────────────────────
router.get('/menu', menuController.getAll);
router.post('/menu', authenticate, authorize(...cmsAdmin), menuController.create);
router.put('/menu/reorder', authenticate, authorize(...cmsAdmin), menuController.reorder); // reorder HARUS sebelum /:id
router.put('/menu/:id', authenticate, authorize(...cmsAdmin), menuController.update);
router.delete('/menu/:id', authenticate, authorize(...cmsAdmin), menuController.remove);

module.exports = router;
