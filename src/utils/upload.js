// src/utils/upload.js - Multer Upload Configuration
// Di development: menyimpan file ke disk lokal
// Di production (NODE_ENV=production): mengupload ke Cloudinary
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// ─── PRODUCTION: Cloudinary Storage ──────────────────────────
let upload;

if (IS_PRODUCTION) {
  const { makeCloudinaryStorage } = require('./cloudinary');

  // Di Cloudinary, folder ditentukan berdasarkan fieldname
  const cloudinaryStorage = makeCloudinaryStorage('uploads');

  const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Tipe file tidak diizinkan.'));
    }
  };

  upload = multer({
    storage: cloudinaryStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
  });

} else {
  // ─── DEVELOPMENT: Disk Storage ────────────────────────────
  const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  };

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      let folder = 'uploads/misc';
      if (file.fieldname === 'coverImage') folder = 'uploads/cms';
      if (file.fieldname === 'photo') folder = 'uploads/ppdb/photos';
      if (['docBirthCert', 'docKartuKeluarga', 'docIjazahTK'].includes(file.fieldname)) {
        folder = 'uploads/ppdb/documents';
      }
      if (file.fieldname === 'attachment') folder = 'uploads/leave';
      if (['logo', 'favicon'].includes(file.fieldname)) folder = 'uploads/settings';
      if (file.fieldname === 'selfie') folder = 'uploads/attendance/selfies';

      ensureDir(folder);
      cb(null, folder);
    },
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Tipe file tidak diizinkan. Hanya jpg, png, gif, webp, pdf, doc, docx.'));
    }
  };

  upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }, // Maks 5MB per file
  });
}

module.exports = upload;
