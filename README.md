# SDIT Iqra 2 Kota Bengkulu — Backend API

**Sistem Informasi Terpadu SD Islam Terpadu Iqra 2 Kota Bengkulu (Core Backend API)**

Backend ini adalah jantung utama yang melayani tiga pilar sistem digital sekolah dalam satu arsitektur *monolithic* yang tangguh berbasis **Express.js, Prisma ORM, dan PostgreSQL**.

## 🚀 Tiga Pilar Sistem Utama

Sistem backend ini terbagi menjadi 3 modul raksasa yang saling terintegrasi:

### 1. Modul Web CMS (Content Management System)
Sistem manajemen konten terpusat untuk mengontrol informasi di website publik sekolah:
- **Manajemen Berita & Artikel:** CRUD berita, kategori, dan *tag*.
- **Halaman Statis:** Pembuatan halaman profil, visi misi, dan informasi sekolah secara dinamis.
- **Pengaturan Website:** Kontrol identitas sekolah, logo, detail kontak, dan tautan sosial media.
- **Upload Media:** Integrasi penyimpanan foto dan dokumen *online*.

### 2. Modul PPDB (Penerimaan Peserta Didik Baru)
Mesin otomatisasi pendaftaran siswa baru secara *online*:
- **Portal Pendaftaran:** Pemrosesan formulir pendaftaran, data siswa, data orang tua, dan nilai asal sekolah.
- **Document Management:** Sistem pengunggahan dan verifikasi berkas persyaratan (KK, Akta, Pas Foto).
- **Verifikasi Pembayaran:** Pencatatan dan konfirmasi pembayaran biaya pendaftaran.
- **Sistem Seleksi:** Logika penilaian seleksi dan pemeringkatan kelulusan calon siswa.

### 3. Modul Absensi Pegawai Berbasis GPS & Face Recognition
Sistem kedisiplinan guru dan karyawan berbasis pelacakan lokasi dan deteksi wajah (Bekerja paralel dengan Mobile App):
- **GPS Geofencing:** Algoritma kalkulasi jarak *Haversine* untuk memastikan guru absen di radius sekolah yang disetel.
- **Validasi Keamanan Absen:** Deteksi anomali (*Fake GPS*/pengubah lokasi palsu) dan integrasi skor *Face Recognition* dari alat Mobile.
- **Leave Workflow:** Pemrosesan pengajuan sakit, izin, cuti berserta file buktinya (Approval/Rejection).
- **Pengelolaan Hari Libur:** Pencatatan hari libur nasional dan sekolah untuk menghitung persentase kehadiran bersih.
- **Excel Report Generator:** *Endpoint* khusus untuk mencetak spreadsheet laporan gabungan jam kehadiran, keterlambatan, dan histori pegawai tiap bulannya.

## 🛠 Instalasi Developer & *Deployment*

1. Pastikan terinstal *engine* node.js, npm, serta rute database eksternal `PostgreSQL`.
2. Masuk ke direktori: `cd apps/backend`.
3. Pasang dependensi API: `npm install`
4. Deklarasikan konfigurasi lokal rahasia Anda di file `.env` → `DATABASE_URL=...` 
5. Inisialisasi/Migrasi Tabel Database: `npx prisma migrate dev`
6. Mulai server *development*: `npm run dev` (Server akan siaga di Port 4000).  

Di lingkungan *production* server dapat langsung dijalankan dan diarahkan menggunakan `node index.js`.
