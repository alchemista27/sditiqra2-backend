// src/utils/slugify.js
/**
 * Mengubah string menjadi URL-friendly slug.
 * Contoh: "Berita Terbaru 2026" → "berita-terbaru-2026"
 */
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Spasi → tanda hubung
    .replace(/[^\w\-]+/g, '')    // Hapus karakter non-word
    .replace(/\-\-+/g, '-')      // Ganda tanda hubung → satu
    .replace(/^-+/, '')           // Hapus tanda hubung di awal
    .replace(/-+$/, '');          // Hapus tanda hubung di akhir
};

module.exports = slugify;
