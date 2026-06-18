import { recommendBaeminLayouts } from '../../lib/claude.js';

export const config = {
  api: { bodyParser: { sizeLimit: '512kb' } },
  maxDuration: 30,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const { cards, aspectRatio, sourceType, layoutPreference } = req.body || {};
  if (!Array.isArray(cards) || cards.length === 0) {
    res.status(400).json({ ok: false, error: 'cards 배열이 필요합니다.' });
    return;
  }

  try {
    const result = await recommendBaeminLayouts(cards, { aspectRatio, sourceType, layoutPreference });
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('[recommend-baemin-layouts] error:', err);
    res.status(500).json({
      ok: false,
      error: err.message?.slice(0, 200) || '배민 레이아웃 추천 중 오류가 발생했습니다.',
    });
  }
}
