// src/utils/upload.js - Multer Upload Configuration
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Buat direktori uploads jika belum ada
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

    ensureDir(folder);
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Tipe file tidak diizinkan. Hanya jpg, png, gif, pdf, doc, docx.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Maks 5MB per file
});

module.exports = upload;
