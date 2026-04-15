// POST /api/generate-cards-from-article (SSE)
// Body: { article, presetId, cardCount, aspectRatio, copyTone }
// Stream events:
//   analyzing, dividing, cards-ready, progress, card, done, error

import { divideArticleToCards, getArticleStylePreset } from '../../lib/claude.js';
import { generateImage, persistImageToBucket } from '../../lib/falai.js';

export const config = {
  api: { bodyParser: { sizeLimit: '2mb' } },
};

function sseSend(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') res.flush();
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // SSE 헤더
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const { article, presetId, cardCount, aspectRatio, copyTone, imageMode: rawMode } = req.body || {};

  if (!article || !article.body) {
    sseSend(res, 'error', { code: 'MISSING_ARTICLE', message: '기사 데이터가 없습니다.' });
    return res.end();
  }

  const projectId = genId();
  const preset = getArticleStylePreset(presetId);
  const ar = aspectRatio || '1:1';
  const imageMode = rawMode === 'generate' ? 'generate' : 'reuse';
  const availableImages = Array.isArray(article.images) ? article.images.length : 0;

  // reuse 모드인데 이미지가 0장이면 거부 (유저 쪽에서 막혀야 하지만 안전망)
  if (imageMode === 'reuse' && availableImages === 0) {
    sseSend(res, 'error', {
      code: 'NO_IMAGES_TO_REUSE',
      message: '본문 이미지 사용 모드는 원본 이미지가 필요합니다. 기사에서 이미지를 추출할 수 없었습니다.',
    });
    return res.end();
  }

  try {
    // 1) Claude로 카드 분할
    sseSend(res, 'analyzing', { message: '본문을 분석하고 있어요' });

    const divided = await divideArticleToCards(article, {
      cardCount: cardCount === 'auto' || !cardCount ? 'auto' : Number(cardCount),
      tone: copyTone || 'hooking',
      presetId,
      imageMode,
    });

    sseSend(res, 'dividing', { message: `${divided.cards.length}장으로 나눴어요` });
    sseSend(res, 'cards-ready', {
      title: divided.title,
      cardCount: divided.cards.length,
      presetId,
    });

    // 2) 이미지 처리 (reuse는 즉시, generate는 병렬)
    const generateTargets = divided.cards
      .map((c, i) => ({ ...c, _origIndex: i }))
      .filter(c => c.imageStrategy === 'generate');

    let generatedCount = 0;
    const total = generateTargets.length;

    // 병렬 처리 (동시 3개)
    const concurrency = 3;
    const cardResults = new Array(divided.cards.length);

    // 먼저 reuse/none 카드부터 즉시 방출
    for (const c of divided.cards) {
      if (c.imageStrategy === 'reuse') {
        const bgImage = article.images[c.sourceImageIndex] || null;
        const finalCard = buildCard(c, {
          bgImage,
          sourceType: 'article',
          aiImageSource: 'article',
          aspectRatio: ar,
          stylePresetId: presetId,
        });
        cardResults[c.index] = finalCard;
        sseSend(res, 'card', { index: c.index, card: finalCard });
      } else if (c.imageStrategy === 'none') {
        const finalCard = buildCard(c, {
          bgImage: null,
          sourceType: 'article',
          aiImageSource: 'none',
          aspectRatio: ar,
          stylePresetId: presetId,
        });
        cardResults[c.index] = finalCard;
        sseSend(res, 'card', { index: c.index, card: finalCard });
      }
    }

    sseSend(res, 'progress', { current: 0, total, stage: 'generating' });

    // generate 카드들을 동시성 제한 걸어 병렬 처리
    let cursor = 0;
    const workers = Array.from({ length: Math.min(concurrency, generateTargets.length) }, async () => {
      while (true) {
        const myIdx = cursor++;
        if (myIdx >= generateTargets.length) return;
        const c = generateTargets[myIdx];
        const fullPrompt = `${preset.stylePrefix}, ${c.imagePrompt}, no text, no letters, no typography`;

        let bgImage = null;
        let aiMeta = { prompt: fullPrompt, seed: null, status: 'pending' };

        try {
          const img = await generateImage({
            prompt: fullPrompt,
            aspectRatio: ar,
            seed: c.seed,
          });
          // 버킷에 영속화 시도 (실패 시 CDN URL 그대로)
          try {
            const persisted = await persistImageToBucket(img.url, projectId, c.index);
            bgImage = persisted.finalUrl || img.url; // 버킷 업로드 성공 시 원본 CDN URL을 일단 쓰고, M2에서 bucketKey 기반 URL 도입
            aiMeta = { prompt: fullPrompt, seed: img.seed, status: 'ok', bucketKey: persisted.bucketKey };
          } catch {
            bgImage = img.url;
            aiMeta = { prompt: fullPrompt, seed: img.seed, status: 'ok', bucketKey: null };
          }
        } catch (err) {
          aiMeta = {
            prompt: fullPrompt,
            seed: null,
            status: 'failed',
            errorCode: err.code || 'UNKNOWN',
            errorMessage: err.message,
          };
          // 폴백: 그라데이션 배경 표시용 null
          bgImage = null;
        }

        const finalCard = buildCard(c, {
          bgImage,
          sourceType: 'article',
          aiImageSource: aiMeta.status === 'ok' ? 'ai' : 'fallback',
          aspectRatio: ar,
          stylePresetId: presetId,
          aiMeta,
        });

        cardResults[c.index] = finalCard;
        generatedCount++;

        sseSend(res, 'card', { index: c.index, card: finalCard });
        sseSend(res, 'progress', { current: generatedCount, total, stage: 'generating' });
      }
    });

    await Promise.all(workers);

    // 3) 완료
    sseSend(res, 'done', {
      projectId,
      title: divided.title,
      cards: cardResults,
      sourceUrl: article.sourceUrl || null,
      sourceTitle: article.title || '',
      sourceImages: article.images || [],
    });
  } catch (err) {
    console.error('[generate-cards-from-article] error:', err);
    sseSend(res, 'error', {
      code: err.code || 'UNKNOWN',
      message: err.message || '생성 중 알 수 없는 오류가 발생했습니다.',
    });
  } finally {
    res.end();
  }
}

// Claude 카드 데이터 → yt2c 카드 스키마로 변환
// 실제 필드명은 M2에서 CARD_KEY_MAP 확장 후 최종 확정.
// 여기서는 기존 yt2c의 기본 카드 구조(title/subtitle/body/...)와 최대한 호환되는 생성 결과 반환.
function buildCard(claudeCard, ctx) {
  const { bgImage, sourceType, aiImageSource, aspectRatio, stylePresetId, aiMeta } = ctx;
  // 첫 카드(index===0)만 cover, 나머지 전부 content로 강제
  const isCover = claudeCard.index === 0;
  const normalizedType = isCover ? 'cover' : 'content';

  // cover  → title + subtitle, body 숨김
  // content → body, title/subtitle 숨김
  const title = isCover ? (claudeCard.headline || '') : '';
  const subtitle = isCover ? (claudeCard.subtext || '') : '';
  const body = isCover ? '' : (claudeCard.body || claudeCard.headline || claudeCard.subtext || '');

  // 모든 article 카드는 full_bg 레이아웃 (이미지가 카드 전체 덮음)
  // full_bg 프리셋 (STYLE_PRESETS line 160) 표준값을 그대로 적용해 검증된 렌더 경로를 탐.
  return {
    id: genId(),
    sourceType,                       // 'article'
    articleType: normalizedType,      // 'cover' | 'content'
    // 에디터 호환 필드 (DEFAULT_CARD 키 재사용)
    title,
    subtitle,
    body,
    useTitle: !!title,
    useSubtitle: !!subtitle,
    useBody: !!body,
    // 폰트 크기 (cover는 제목 강조, content는 본문 중심)
    titleSize: isCover ? 72 : 56,
    subtitleSize: isCover ? 44 : 40,
    bodySize: 40,
    bodyLineHeight: 1.55,
    titleLineHeight: 1.25,
    // 배경 이미지
    uploadedImage: bgImage,
    fillSource: bgImage ? 'image' : 'color',
    // full_bg 프리셋 표준값: bgColor #0a0a0a + bgOpacity 0.75 + useGradient false + useBg true
    useBg: true,
    bgColor: '#0a0a0a',
    bgOpacity: 0.75,
    useGradient: false,
    // photoRatio는 full_bg에서는 무시되지만, 유저가 레이아웃 탭에서
    // photo_top/photo_bottom/gradient_*로 전환할 때 sensible default가 필요.
    // (레이아웃 탭 클릭 핸들러는 photoRatio를 업데이트하지 않음 — line 6704 참조)
    photoRatio: 55,
    // text_box 레이아웃 전환 대비 기본값 (영상 카드와 동일)
    textBoxX: 50, textBoxY: 70, textBoxWidth: 80, textBoxPadding: 20, textBoxRadius: 12,
    // 색상 (프리셋 값)
    titleColor: '#ffffff',
    subtitleColor: '#e0e0e0',
    bodyColor: '#f0f0f0',
    // 정렬
    titleAlign: 'left',
    subtitleAlign: 'left',
    bodyAlign: 'left',
    // 위치 (full_bg는 기본 0, 에디터에서 조정 가능)
    titleY: 0, subtitleY: 0, bodyY: 0,
    // article 전용 메타 (CARD_KEY_MAP '8')
    articleMeta: {
      aiImageSource,                  // 'article' | 'ai' | 'fallback' | 'none'
      sourceImageIndex: claudeCard.sourceImageIndex ?? null,
      aiImagePrompt: aiMeta?.prompt || null,
      aiImageSeed: aiMeta?.seed ?? null,
      aiImageStatus: aiMeta?.status || null,
      aiImageError: aiMeta?.errorMessage || null,
      stylePresetId,
    },
    layout: 'full_bg',
  };
}
