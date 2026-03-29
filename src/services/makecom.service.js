const prisma = require('../lib/prisma');

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL || '';

async function sendToInstagram(post) {
  try {
    if (!MAKE_WEBHOOK_URL) {
      console.log('[MakeWebhook] MAKE_WEBHOOK_URL not configured, skipping');
      return;
    }

    const settings = await prisma.siteSetting.findMany({
      where: { key: { startsWith: 'instagram_' } },
    });
    const s = Object.fromEntries(settings.map(r => [r.key, r.value]));

    if (s.instagram_auto_post !== 'true') {
      return;
    }

    if (!post.coverImage) {
      console.log('[MakeWebhook] Skipping — no cover image');
      return;
    }

    let imageUrl = post.coverImage;

    if (imageUrl.startsWith('/uploads/')) {
      console.log('[MakeWebhook] Skipping — local path, needs public URL');
      return;
    }

    if (!imageUrl.startsWith('http')) {
      imageUrl = `https://${imageUrl}`;
    }

    let caption = post.title;
    if (post.excerpt) {
      caption += '\n\n' + post.excerpt;
    }
    caption += '\n\n#SDITIqra2 #BeritaSekolah';
    if (caption.length > 2200) {
      caption = caption.substring(0, 2197) + '...';
    }

    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt || '',
        imageUrl,
        caption,
        publishedAt: post.publishedAt || new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error(`[MakeWebhook] HTTP ${response.status}: ${response.statusText}`);
    } else {
      console.log(`[MakeWebhook] Sent post ${post.id} to Make.com`);
    }
  } catch (error) {
    console.error('[MakeWebhook] Error:', error.message);
  }
}

module.exports = { sendToInstagram };