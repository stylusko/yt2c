import assert from 'node:assert/strict';
import {
  ARTICLE_BODY_MAX_LINES,
  estimateArticleBodyLines,
  fitArticleBodyToFourLines,
  normalizeArticleSourceNames,
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

assert.throws(
  () => parseClaudeJsonObject('{ "title": "깨진 응답", '),
  /AI 응답 형식이 깨졌습니다/,
);

console.log('PASS article card text fit and source naming');
