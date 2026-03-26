require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require('bcryptjs');

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Memulai perbaikan data database ---');

  // 1. Password Admin
  const hashedPassword = await bcrypt.hash('admin123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@sditiqra2kotabengkulu.sch.id' },
    update: { password: hashedPassword, role: 'SUPER_ADMIN' },
    create: {
      name: 'Super Administrator',
      email: 'admin@sditiqra2kotabengkulu.sch.id',
      password: hashedPassword,
      role: 'SUPER_ADMIN',
    },
  });
  console.log('✅ Password Admin berhasil diset menjadi admin123');

  // 2. Logo tidak tampil
  const logoUrl = 'https://ui-avatars.com/api/?name=SD+IT+Iqra+2&background=1B6B44&color=fff&size=200&rounded=true';
  await prisma.siteSetting.upsert({
    where: { key: 'site_logo' },
    update: { value: logoUrl },
    create: { key: 'site_logo', value: logoUrl },
  });
  console.log('✅ Logo situs diset ke avatar placeholder');

  // 3. Menu Web
  const existingMenus = await prisma.menuItem.count();
  if (existingMenus === 0) {
    console.log('⚠️ Menu web kosong, membuat ulang data default...');
    const defaultMenuItems = [
      { label: 'Beranda', url: '/', order: 0, isActive: true },
      { label: 'Tentang', url: '/halaman/tentang-kami', order: 1, isActive: true },
      { label: 'Berita', url: '/berita', order: 2, isActive: true },
      { label: 'PPDB', url: '/ppdb', order: 3, isActive: true },
      { label: 'Kontak', url: '/halaman/kontak', order: 4, isActive: true },
    ];
    for (const item of defaultMenuItems) {
      await prisma.menuItem.create({ data: item });
    }
  } else {
    console.log(`✅ Ditemukan ${existingMenus} menu di database. Mengaktifkan semua menu...`);
    await prisma.menuItem.updateMany({ data: { isActive: true } });
  }

  console.log('--- Semua perbaikan data telah diaplikasikan! ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
