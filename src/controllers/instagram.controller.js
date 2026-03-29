const prisma = require('../lib/prisma');
const { successResponse, errorResponse } = require('../utils/response');

exports.testConnection = async (req, res) => {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { key: { startsWith: 'instagram_' } },
    });
    const s = Object.fromEntries(settings.map(r => [r.key, r.value]));

    if (s.instagram_auto_post !== 'true') {
      return errorResponse(res, 'Auto-post belum diaktifkan.', 400);
    }

    const webhookUrl = s.instagram_make_webhook_url;
    if (!webhookUrl) {
      return errorResponse(res, 'Webhook URL belum dikonfigurasi.', 400);
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: 'test',
        title: 'Test Koneksi',
        imageUrl: 'https://via.placeholder.com/1080x1080/1B6B44/ffffff?text=Test',
        caption: 'Test koneksi dari Admin Panel — abaikan post ini.',
      }),
    });

    if (!response.ok) {
      return errorResponse(res, `Make.com webhook gagal: HTTP ${response.status}`, 400);
    }

    return successResponse(res, { connected: true }, 'Koneksi Make.com berhasil.');
  } catch (error) {
    return errorResponse(res, 'Koneksi gagal: ' + error.message, 400, error);
  }
};

exports.updateInstagramStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, igPostId, error: igError } = req.body;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) return errorResponse(res, 'Berita tidak ditemukan.', 404);

    const statusData = JSON.stringify({
      status,
      postId: id,
      postTitle: post.title,
      igPostId: igPostId || null,
      error: igError || null,
      timestamp: new Date().toISOString(),
    });

    await prisma.siteSetting.upsert({
      where: { key: 'instagram_last_post_status' },
      update: { value: statusData },
      create: { key: 'instagram_last_post_status', value: statusData },
    });

    return successResponse(res, { status, igPostId }, 'Status Instagram berhasil diupdate.');
  } catch (error) {
    return errorResponse(res, 'Gagal update status Instagram.', 500, error);
  }
};