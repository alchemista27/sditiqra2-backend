// src/utils/cloudinary.js - Cloudinary configuration & helper
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Buat storage Cloudinary untuk multer berdasarkan nama folder.
 * Mendukung gambar (jpg/png/webp) dan dokumen (pdf).
 */
const makeCloudinaryStorage = (folder) =>
  new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const isPdf = file.mimetype === 'application/pdf';
      return {
        folder: `sditiqra2/${folder}`,
        resource_type: isPdf ? 'raw' : 'image',
        allowed_formats: isPdf
          ? ['pdf']
          : ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        ...(isPdf ? {} : { transformation: [{ quality: 'auto', fetch_format: 'auto' }] }),
      };
    },
  });

module.exports = { cloudinary, makeCloudinaryStorage };

