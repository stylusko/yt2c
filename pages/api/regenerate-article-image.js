// POST /api/regenerate-article-image
// Body: { prompt, presetId, aspectRatio }
// Response: { ok: true, url, seed, prompt } | { ok: false, error }
//
// 카드 단위 AI 이미지 재생성용 경량 엔드포인트.
// generate-cards-from-article 는 Claude 분할까지 포함한 full 파이프라인이라 단건 재생성엔 과함.

import { generateImage } from '../../lib/falai.js';
import { getArticleStylePreset, listArticleStylePresets } from '../../lib/claude.js';

export const config = {
  api: { bodyParser: { sizeLimit: '64kb' } },
};

// 예전 버전에서 aiImagePrompt 에 stylePrefix 까지 통째로 저장된 경우를 위한 sanitizer.
// 알려진 모든 preset 의 stylePrefix 문자열을 "정확히" prefix-match 해서 제거한다.
// 마커 기반 휴리스틱은 preset 추가/수정 시 깨지기 쉬워서 전체 prefix 매칭이 가장 견고함.
function stripStylePrefix(p) {
  if (!p || typeof p !== 'string') return p;
  let s = p.trim();
  // 꼬리 제거
  s = s.replace(/,\s*no text[^,]*,\s*no letters[^,]*,\s*no typography\s*$/i, '').trim();
  for (const { id } of listArticleStylePresets()) {
    const prefix = getArticleStylePreset(id).stylePrefix;
    if (!prefix) continue;
    if (s.startsWith(prefix)) {
      return s.slice(prefix.length).replace(/^,\s*/, '').trim();
    }
  }
  return s;
}

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
    // 구버전 카드 호환: 저장된 프롬프트에 이전 stylePrefix 가 섞여 있으면 제거
    const subject = stripStylePrefix(prompt);
    const fullPrompt = `${preset.stylePrefix}, ${subject}, no text, no letters, no typography`;

    const img = await generateImage({ prompt: fullPrompt, aspectRatio: ar });

    return res.status(200).json({
      ok: true,
      url: img.url,
      seed: img.seed,
      // 재저장 시에도 subject 만 보관해 다음 재생성에서 스타일 섞임 방지
      prompt: subject,
    });
  } catch (err) {
    const msg = err?.message || 'AI 재생성 실패';
    const code = err?.code || 'UNKNOWN';
    const status = code === 'NO_API_KEY' ? 500 : code === 'BAD_PROMPT' ? 400 : 500;
    return res.status(status).json({ ok: false, error: msg, code });
  }
}
