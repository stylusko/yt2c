// POST /api/regenerate-article-image
// Body: { prompt, presetId, aspectRatio }
// Response: { ok: true, url, seed, prompt } | { ok: false, error }
//
// 카드 단위 AI 이미지 재생성용 경량 엔드포인트.
// generate-cards-from-article 는 Claude 분할까지 포함한 full 파이프라인이라 단건 재생성엔 과함.

import { generateImage } from '../../lib/falai.js';
import { getArticleStylePreset } from '../../lib/claude.js';

export const config = {
  api: { bodyParser: { sizeLimit: '64kb' } },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { prompt, presetId, aspectRatio } = req.body || {};
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return res.status(400).json({ ok: false, error: '프롬프트가 비어있습니다.' });
    }

    const preset = getArticleStylePreset(presetId);
    const ar = aspectRatio || '1:1';
    const fullPrompt = `${preset.stylePrefix}, ${prompt}, no text, no letters, no typography`;

    const img = await generateImage({ prompt: fullPrompt, aspectRatio: ar });

    return res.status(200).json({
      ok: true,
      url: img.url,
      seed: img.seed,
      prompt: fullPrompt,
    });
  } catch (err) {
    const msg = err?.message || 'AI 재생성 실패';
    const code = err?.code || 'UNKNOWN';
    const status = code === 'NO_API_KEY' ? 500 : code === 'BAD_PROMPT' ? 400 : 500;
    return res.status(status).json({ ok: false, error: msg, code });
  }
}
