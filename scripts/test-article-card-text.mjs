import assert from 'node:assert/strict';
import {
  ARTICLE_BODY_MAX_LINES,
  baeminAllowedLayoutIdsForRecommendation,
  estimateArticleBodyLines,
  fitBaeminAiHeadlineLine,
  fitBaeminAiHeadlinePair,
  fitArticleBodyToFourLines,
  normalizeArticleSourceNames,
  parseArticleCardsResponse,
  parseClaudeJsonObject,
} from '../lib/claude.js';

const baeminUrl = 'https://ceo.baemin.com/knowhow/11654';

const longBody = [
  '외식업 매장은 명절과 연휴 기간 주문이 몰리는 시간대를 예측하고, 메뉴 준비와 직원 배치를 미리 조정해야 합니다.',
  '고객에게 조리 지연 가능성을 안내하고, 품절 메뉴는 빠르게 숨기는 것이 중요합니다.',
  '배달앱 공지와 매장 안내 문구를 함께 정비하면 불필요한 취소를 줄이고 재주문 가능성을 높일 수 있습니다.',
  '이런 준비가 연휴 운영의 안정성을 만듭니다.',
].join(' ');

const fitted = fitArticleBodyToFourLines(longBody, { hasHeadline: false });
assert.ok(
  estimateArticleBodyLines(fitted, { hasHeadline: false }) <= ARTICLE_BODY_MAX_LINES,
  `body should fit within ${ARTICLE_BODY_MAX_LINES} lines: ${fitted}`
);

const fittedWithHeadline = fitArticleBodyToFourLines(longBody, { hasHeadline: true });
assert.ok(
  estimateArticleBodyLines(fittedWithHeadline, { hasHeadline: true }) <= ARTICLE_BODY_MAX_LINES,
  `body with headline should fit within ${ARTICLE_BODY_MAX_LINES} lines: ${fittedWithHeadline}`
);

const sourceText = '자세한 정보는 배민사장님광장과 배민 사장님 사이트에서 확인하세요.';
const normalized = normalizeArticleSourceNames(sourceText, baeminUrl);
assert.equal(normalized, '자세한 정보는 배민외식업광장과 배민외식업광장에서 확인하세요.');

const normalizedBody = fitArticleBodyToFourLines(sourceText, { sourceUrl: baeminUrl });
assert.ok(!/배민\s*사장님|배민사장님광장/.test(normalizedBody), normalizedBody);
assert.ok(normalizedBody.includes('배민외식업광장'), normalizedBody);

const baeminPair = fitBaeminAiHeadlinePair('전기료 골라 내세요', '6월부터 더 싸게');
assert.equal(baeminPair.title, '전기료 골라 내세요');
assert.equal(baeminPair.subtitle, '6월부터 더 싸게');
assert.ok(!/\n/.test(baeminPair.title + baeminPair.subtitle));
assert.ok(baeminPair.title.length <= 14);
assert.ok(baeminPair.subtitle.length <= 14);

const legacyBaeminPair = fitBaeminAiHeadlinePair('영수증 하단에\nQR코드가 추가돼요');
assert.equal(legacyBaeminPair.title, '영수증 하단에');
assert.equal(legacyBaeminPair.subtitle, 'QR코드가 추가돼요');
assert.ok(legacyBaeminPair.title.length <= 14);
assert.ok(legacyBaeminPair.subtitle.length <= 14);

assert.equal(fitBaeminAiHeadlineLine('제목에\n개행 금지'), '제목에 개행 금지');
assert.equal(fitBaeminAiHeadlineLine('6월부터 전기료 더 싸게'), '6월부터 전기료 더 싸게');
assert.equal(fitBaeminAiHeadlineLine('띄어쓰기 포함 열네자 이상 긴 문장'), '띄어쓰기 포함 열네자');

assert.deepEqual(
  baeminAllowedLayoutIdsForRecommendation(
    { hasVisual: true, hasTitle: true, hasSubtitle: true, hasBody: false },
    1,
    '3:4',
    'youtube',
  ),
  ['bm-video-post-title-top', 'bm-video-post-title-bottom'],
  'BM ONLY 3:4 video body cards should stay on video-post guide layouts',
);

assert.ok(
  baeminAllowedLayoutIdsForRecommendation(
    { hasVisual: true, hasTitle: true, hasSubtitle: true, hasBody: true },
    1,
    '3:4',
    'youtube',
  ).includes('bm-photo-body'),
  'video cards with body copy can still use richer photo-body layouts',
);

const looseJson = `Here is the JSON:
{
  "title": "테스트"
  "cards": [
    {
      "type": "cover",
      "headline": "할인 팝업",
      "subtext": "타임세일 오픈",
      "body": "",
      "imageStrategy": "reuse",
      "sourceImageIndex": 0,
    }
  ],
}`;

const parsedLooseJson = parseClaudeJsonObject(looseJson);
assert.equal(parsedLooseJson.title, '테스트');
assert.equal(parsedLooseJson.cards[0].imageStrategy, 'reuse');

const fallbackCard = {
  type: 'cover',
  headline: 'fallback 카드',
  subtext: '배열 응답도 복구',
  body: '',
  imageStrategy: 'generate',
  imagePrompt: 'editorial scene, no text',
};

const parsedArrayCards = parseArticleCardsResponse(JSON.stringify([fallbackCard]), 'fallback 제목');
assert.equal(parsedArrayCards.title, 'fallback 제목');
assert.equal(parsedArrayCards.cards[0].headline, fallbackCard.headline);

const parsedNestedCards = parseArticleCardsResponse(JSON.stringify({
  projectTitle: '중첩 응답',
  payload: { slides: [fallbackCard] },
}));
assert.equal(parsedNestedCards.title, '중첩 응답');
assert.equal(parsedNestedCards.cards[0].subtext, fallbackCard.subtext);

assert.throws(
  () => parseClaudeJsonObject('{ "title": "깨진 응답", '),
  /AI 응답 형식이 깨졌습니다/,
);

console.log('PASS article card text fit and source naming');
