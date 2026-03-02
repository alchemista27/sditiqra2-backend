// prisma/seed.js - Data awal untuk development
require('dotenv').config({ path: '../.env' });
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Memulai seeding data...');

  // ─── Super Admin ──────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@sditiqra2kotabengkulu.sch.id' },
    update: {},
    create: {
      name: 'Super Administrator',
      email: 'admin@sditiqra2kotabengkulu.sch.id',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  });
  console.log('✅ Super Admin dibuat:', superAdmin.email);

  // ─── Kategori Berita ──────────────────────────────────────
  const categories = [
    { name: 'Pengumuman', slug: 'pengumuman', description: 'Pengumuman resmi sekolah' },
    { name: 'Berita Sekolah', slug: 'berita-sekolah', description: 'Berita kegiatan sekolah' },
    { name: 'PPDB', slug: 'ppdb', description: 'Informasi Penerimaan Siswa Baru' },
    { name: 'Prestasi', slug: 'prestasi', description: 'Prestasi siswa dan sekolah' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log('✅ Kategori berita dibuat.');

  // ─── Halaman Statis ───────────────────────────────────────
  const staticPages = [
    {
      title: 'Tentang Kami',
      slug: 'tentang-kami',
      sortOrder: 1,
      content: `<h2>SD Islam Terpadu Iqra 2 Kota Bengkulu</h2>
<p>SD Islam Terpadu Iqra 2 Kota Bengkulu adalah sekolah dasar berbasis Islam yang berkomitmen untuk memberikan pendidikan berkualitas dengan mengintegrasikan nilai-nilai Islam dalam setiap aspek pembelajaran.</p>`,
    },
    {
      title: 'Visi dan Misi',
      slug: 'visi-misi',
      sortOrder: 2,
      content: `<h2>Visi</h2>
<p>Mewujudkan generasi Islami yang cerdas, berakhlak mulia, dan berprestasi.</p>
<h2>Misi</h2>
<ul>
  <li>Menyelenggarakan pendidikan Islam yang berkualitas dan menyenangkan.</li>
  <li>Membentuk karakter siswa yang berakhlak mulia dan bertanggung jawab.</li>
  <li>Mengembangkan potensi akademik dan non-akademik siswa secara optimal.</li>
  <li>Menciptakan lingkungan belajar yang kondusif dan Islami.</li>
</ul>`,
    },
    {
      title: 'Ekstrakulikuler',
      slug: 'ekstrakulikuler',
      sortOrder: 3,
      content: `<h2>Kegiatan Ekstrakulikuler</h2>
<p>SD IT Iqra 2 menyediakan beragam kegiatan ekstrakulikuler untuk mengembangkan bakat dan minat siswa.</p>`,
    },
    {
      title: 'Fasilitas',
      slug: 'fasilitas',
      sortOrder: 4,
      content: `<h2>Fasilitas Sekolah</h2>
<p>Kami menyediakan fasilitas lengkap untuk mendukung proses belajar mengajar yang optimal.</p>`,
    },
    {
      title: 'Kontak',
      slug: 'kontak',
      sortOrder: 5,
      content: `<h2>Hubungi Kami</h2>
<p><strong>SD Islam Terpadu Iqra 2 Kota Bengkulu</strong></p>
<p>Kota Bengkulu, Provinsi Bengkulu</p>`,
    },
  ];

  for (const pg of staticPages) {
    await prisma.page.upsert({
      where: { slug: pg.slug },
      update: {},
      create: { ...pg, status: 'PUBLISHED', authorId: superAdmin.id },
    });
  }
  console.log('✅ Halaman statis dibuat.');

  // ─── Contoh Berita ────────────────────────────────────────
  const ppdbCat = await prisma.category.findUnique({ where: { slug: 'ppdb' } });
  const pengumumanCat = await prisma.category.findUnique({ where: { slug: 'pengumuman' } });

  await prisma.post.upsert({
    where: { slug: 'pendaftaran-siswa-baru-tahun-ajaran-2026-2027' },
    update: {},
    create: {
      title: 'Pendaftaran Siswa Baru Tahun Ajaran 2026/2027 Telah Dibuka!',
      slug: 'pendaftaran-siswa-baru-tahun-ajaran-2026-2027',
      excerpt: 'SD IT Iqra 2 Bengkulu dengan bangga mengumumkan pembukaan penerimaan siswa baru untuk tahun ajaran 2026/2027.',
      content: `<p>Alhamdulillah, SD Islam Terpadu Iqra 2 Kota Bengkulu membuka pendaftaran siswa baru untuk tahun ajaran <strong>2026/2027</strong>.</p>
<h3>Persyaratan Pendaftaran</h3>
<ul>
  <li>Berusia minimal 6 tahun per 1 Juli 2026</li>
  <li>Membawa fotokopi Akta Kelahiran</li>
  <li>Membawa fotokopi Kartu Keluarga</li>
  <li>Pas foto ukuran 3x4 (4 lembar)</li>
</ul>
<p>Untuk informasi lebih lanjut, hubungi front office sekolah.</p>`,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      authorId: superAdmin.id,
      categoryId: ppdbCat?.id,
    },
  });

  await prisma.post.upsert({
    where: { slug: 'selamat-datang-di-website-resmi-sd-it-iqra-2' },
    update: {},
    create: {
      title: 'Selamat Datang di Website Resmi SD IT Iqra 2 Bengkulu',
      slug: 'selamat-datang-di-website-resmi-sd-it-iqra-2',
      excerpt: 'Website resmi SD Islam Terpadu Iqra 2 Kota Bengkulu kini telah hadir untuk memudahkan akses informasi.',
      content: `<p>Kami dengan bangga mempersembahkan website resmi <strong>SD Islam Terpadu Iqra 2 Kota Bengkulu</strong>.</p>
<p>Melalui website ini, Anda dapat mengakses berbagai informasi seputar kegiatan sekolah, pengumuman penting, dan layanan administrasi secara online.</p>`,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      authorId: superAdmin.id,
      categoryId: pengumumanCat?.id,
    },
  });
  console.log('✅ Contoh berita dibuat.');

  console.log('\n🎉 Seeding selesai!');
  console.log('─────────────────────────────────');
  console.log('Login Admin:');
  console.log('  Email   : admin@sditiqra2kotabengkulu.sch.id');
  console.log('  Password: admin123');
  console.log('─────────────────────────────────');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
