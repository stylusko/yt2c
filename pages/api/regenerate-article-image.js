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

// 예전 버전에서 aiImagePrompt 에 stylePrefix 까지 통째로 저장된 경우를 위한 sanitizer.
// 알려진 stylePrefix 시작 문구를 감지하면 해당 prefix 와 'no text...' 꼬리표를 제거해 순수 subject 만 남김.
const KNOWN_STYLE_PREFIX_HEADS = [
  'Professional commercial stock photograph',
  'Cinematic photograph with',
  'Stylized 3D character illustration',
  'Minimalist geometric illustration',
];
function stripStylePrefix(p) {
  if (!p || typeof p !== 'string') return p;
  let s = p.trim();
  // 꼬리 제거
  s = s.replace(/,\s*no text[^,]*,\s*no letters[^,]*,\s*no typography\s*$/i, '').trim();
  for (const head of KNOWN_STYLE_PREFIX_HEADS) {
    if (s.startsWith(head)) {
      // stylePrefix 끝은 'clean image' 또는 'flat design' 또는 쉼표 구분 리스트 끝으로 추정.
      // 가장 안전한 heuristic: subject 앞에 오는 stylePrefix 는 보통 comma 로 구분된 6~15개 수식어 + 마지막에 'clean image' or 'flat design' + comma + subject.
      // 'clean image' 토큰 찾아서 자르고, 없으면 'flat design' 토큰 찾기.
      const endMarkers = [', clean image,', ', flat design,'];
      for (const m of endMarkers) {
        const idx = s.indexOf(m);
        if (idx !== -1) {
          return s.slice(idx + m.length).trim();
        }
      }
      // 마커 못 찾으면 첫 번째 comma 이후 subject 라고 가정하고 50단어 이후 자르기는 과함 → 원문 유지
      return s;
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
