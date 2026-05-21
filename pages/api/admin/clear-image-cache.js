// POST /api/admin/clear-image-cache
// 버킷의 article-images/ 캐시 전체 삭제
// Body: { secret: string, prefix?: string }

import { deleteByPrefix } from '../../../lib/bucket.js';

const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.TELEGRAM_BOT_TOKEN || '';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { secret, prefix = 'article-images/' } = req.body || {};

  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 안전장치: cards/ 전체 삭제는 차단
  if (prefix === 'cards/' || prefix === '') {
    return res.status(400).json({ error: 'Deleting all cards is not allowed via this endpoint' });
  }

  try {
    const deleted = await deleteByPrefix(prefix);
    console.log(`[admin] clear-image-cache: deleted ${deleted} files under "${prefix}"`);
    return res.status(200).json({ ok: true, deleted, prefix });
  } catch (err) {
    console.error('[admin] clear-image-cache error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
