// 웹 아티클 본문 추출기
// 1차: 네이버 블로그 전용 파서 (m.blog.naver.com + se-main-container)
// 2차: Jina Reader 폴백 (https://r.jina.ai/{url})
// 3차: 수동 붙여넣기 정규화

import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 15000;

function isNaverBlogUrl(url) {
  return /^https?:\/\/(m\.)?blog\.naver\.com\//.test(url);
}

function toMobileNaverUrl(url) {
  return url.replace(/^(https?:\/\/)blog\.naver\.com/, '$1m.blog.naver.com');
}

const BAEMIN_CEO_REGEX = /^https?:\/\/(www\.)?ceo\.baemin\.com\/knowhow\/(\d+)/;
function isBaeminCeoUrl(url) {
  return BAEMIN_CEO_REGEX.test(url);
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtml(url) {
  const res = await fetchWithTimeout(url, {
    headers: {
      'User-Agent': BROWSER_UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// 네이버 블로그 전용 파서
async function extractNaverBlog(url) {
  const mobileUrl = toMobileNaverUrl(url);
  const html = await fetchHtml(mobileUrl);
  const $ = cheerio.load(html);

  const title = ($('meta[property="og:title"]').attr('content') || '').trim();
  const ogImage = ($('meta[property="og:image"]').attr('content') || '').trim();
  const description = ($('meta[property="og:description"]').attr('content') || '').trim();
  const author = ($('meta[property="naverblog:nickname"]').attr('content')
    || $('.blog_name').first().text()
    || $('.nick').first().text() || '').trim();

  const blocks = [];
  const images = [];

  const $container = $('.se-main-container').first();
  if ($container.length) {
    // 신형 스마트에디터 ONE
    // 컴포넌트 타입: se-text, se-image, se-imageStrip (2~3장 묶음), se-documentTitle (문서 커버), se-quotation 등
    const extractImgSrc = ($img) =>
      $img.attr('data-lazy-src') || $img.attr('data-src') || $img.attr('src') || '';

    const pushImage = (rawSrc) => {
      if (!rawSrc) return;
      const cleaned = cleanNaverImageUrl(rawSrc);
      if (!cleaned || images.includes(cleaned)) return;
      images.push(cleaned);
      blocks.push({ type: 'image', src: cleaned });
    };

    $container.find('.se-component').each((_, el) => {
      const $el = $(el);
      if ($el.hasClass('se-text')) {
        const text = $el
          .find('.se-text-paragraph')
          .map((__, p) => $(p).text().trim())
          .get()
          .filter(Boolean)
          .join('\n');
        if (text) blocks.push({ type: 'text', text });
      } else if (
        $el.hasClass('se-image') ||
        $el.hasClass('se-imageStrip') ||           // 2~3장 이미지 묶음
        $el.hasClass('se-documentTitle')           // 문서 커버 이미지
      ) {
        // 해당 컴포넌트 내부의 모든 <img>를 순회 — imageStrip은 여러 장 포함
        $el.find('img').each((__, img) => {
          pushImage(extractImgSrc($(img)));
        });
      } else if ($el.hasClass('se-quotation')) {
        const text = $el.find('.se-quote').text().trim();
        if (text) blocks.push({ type: 'quote', text });
      }
    });
  } else {
    // 구형 에디터 fallback
    const $old = $('#postViewArea, .post-view, #post-view').first();
    if ($old.length) {
      const text = $old.text().replace(/\s+/g, ' ').trim();
      if (text) blocks.push({ type: 'text', text });
      $old.find('img').each((_, el) => {
        const src = $(el).attr('src');
        if (src) {
          images.push(src);
          blocks.push({ type: 'image', src });
        }
      });
    }
  }

  const body = blocks
    .filter(b => b.type === 'text' || b.type === 'quote')
    .map(b => b.text)
    .join('\n\n')
    .trim();

  if (!body || body.length < 50) {
    throw new Error('네이버 블로그 본문 파싱 실패 (구조 변경 가능성)');
  }

  return {
    title,
    body,
    blocks,
    images,
    thumbnail: ogImage || images[0] || null,
    description,
    author,
    sourceUrl: url,
    extractor: 'naver-mobile',
  };
}

// 배민 사장님 매거진(ceo.baemin.com) 전용 추출
// SPA라서 HTML 직접 파싱 불가. 공개 API 엔드포인트 활용:
//   https://ceo-square-api.baemin.com/v3/content/{seq}?type=USAGE
// (JS 번들의 fetchKnowhowDetail 함수 역추적으로 확인)
async function extractBaeminCeo(url) {
  const match = url.match(BAEMIN_CEO_REGEX);
  if (!match) throw new Error('배민 CEO URL 형식이 아닙니다');
  const seq = match[2];

  const apiUrl = `https://ceo-square-api.baemin.com/v3/content/${seq}?type=USAGE`;
  // 주의: Baemin API는 Chrome full UA 문자열("Mozilla/5.0 (Macintosh ... Chrome/120 ...")을
  // 봇으로 감지해 403을 반환한다. minimal "Mozilla/5.0" 또는 무헤더가 200을 받는다.
  const res = await fetchWithTimeout(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Origin': 'https://ceo.baemin.com',
    },
  });
  if (!res.ok) throw new Error(`배민 API HTTP ${res.status}`);
  const json = await res.json();
  if (!json?.data) throw new Error('배민 API 응답 형식 오류');

  const d = json.data;
  const contentHtml = d.content || '';
  if (!contentHtml) throw new Error('본문(content)이 비어있습니다');

  // HTML 조각 파싱
  const $ = cheerio.load(`<div id="__root">${contentHtml}</div>`);
  const $root = $('#__root');

  // 이미지 수집 (순서 유지, 중복 제거)
  const images = [];
  $root.find('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
    if (src && /^https?:/i.test(src) && !images.includes(src)) {
      images.push(src);
    }
  });

  // 텍스트 블록 수집 (문단 단위로 break 유지)
  // <p>, <h*>, <li>, <div> 기준으로 텍스트 추출
  const paragraphs = [];
  $root.find('p, h1, h2, h3, h4, h5, h6, li, blockquote').each((_, el) => {
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (t && t.length >= 3) paragraphs.push(t);
  });

  // fallback: paragraph가 적으면 전체 텍스트 덤프
  let body;
  if (paragraphs.length >= 3) {
    body = paragraphs.join('\n\n');
  } else {
    body = $root.text().replace(/\s+/g, ' ').trim();
  }

  if (!body || body.length < 100) {
    throw new Error('배민 매거진 본문 추출 결과가 너무 짧음');
  }

  // blocks (네이버 파서와 호환 — text/image 섞어서)
  const blocks = [];
  if (body) blocks.push({ type: 'text', text: body });
  for (const src of images) blocks.push({ type: 'image', src });

  return {
    title: d.title || '',
    body,
    blocks,
    images,
    thumbnail: d.thumbnail || images[0] || null,
    description: d.contentSummary || '',
    author: '배민외식업광장',
    publishedAt: d.startDisplayTime || '',
    sourceUrl: url,
    extractor: 'baemin-ceo',
  };
}

// 네이버 블로그 이미지 URL 정규화
// 1) mblogthumb-phinf.pstatic.net 은 외부에서 404를 반환 (모바일 앱 전용 CDN).
//    → blogthumb.pstatic.net 으로 도메인 치환.
// 2) ?type 쿼리가 없으면 네이버가 100×80 수준의 초소형 썸네일을 반환함.
//    네이버 type 옵션 (실측): w1=936×759, w2=743×602, w3=550×446, w4+=404
//    → 최대 해상도인 ?type=w1 을 강제 부여.
function cleanNaverImageUrl(src) {
  if (!src) return src;
  let out = src;
  out = out.replace(/mblogthumb-phinf\.pstatic\.net/, 'blogthumb.pstatic.net');
  out = out.replace(/mblogfiles\.pstatic\.net/, 'blogfiles.pstatic.net');
  // 기존 type 쿼리 제거 후
  out = out.replace(/\?type=[\w]+/, '');
  // pstatic.net 계열 이미지면 w1(최대)로 통일
  if (/\.pstatic\.net\//.test(out)) {
    out += (out.includes('?') ? '&' : '?') + 'type=w1';
  }
  return out;
}

// Mozilla Readability 폴백 (Firefox Reader Mode와 동일 엔진)
// 일반 SSR 사이트에 효과적. linkedom을 DOM 구현체로 사용해 JSDOM보다 30배 가벼움.
async function extractViaReadability(url) {
  const html = await fetchHtml(url);
  const { document } = parseHTML(html);
  // <base href> 설정하면 상대 URL이 절대 URL로 변환됨
  try {
    const baseEl = document.createElement('base');
    baseEl.setAttribute('href', url);
    document.head.appendChild(baseEl);
  } catch {}

  const reader = new Readability(document, {
    charThreshold: 300,       // 최소 본문 300자
    classesToPreserve: [],
    keepClasses: false,
  });
  const parsed = reader.parse();

  if (!parsed || !parsed.textContent) {
    throw new Error('Readability 본문 추출 실패');
  }
  const text = parsed.textContent.replace(/\s+/g, ' ').trim();
  if (text.length < 300) {
    throw new Error(`Readability 본문 너무 짧음 (${text.length}자)`);
  }

  // Readability content HTML에서 이미지 추출
  const images = [];
  try {
    const $ = cheerio.load(parsed.content || '');
    $('img').each((_, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-src');
      if (src && /^https?:/i.test(src) && !images.includes(src)) {
        images.push(src);
      }
    });
  } catch {}

  // og:image 보강
  let ogImage = '';
  try {
    const $h = cheerio.load(html);
    ogImage = $h('meta[property="og:image"]').attr('content') || '';
  } catch {}

  return {
    title: parsed.title || '',
    body: text,
    blocks: [
      { type: 'text', text },
      ...images.map(src => ({ type: 'image', src })),
    ],
    images,
    thumbnail: ogImage || images[0] || null,
    description: parsed.excerpt || '',
    author: parsed.byline || '',
    sourceUrl: url,
    extractor: 'readability',
  };
}

// Jina Reader 폴백
async function extractViaJina(url) {
  const jinaUrl = `https://r.jina.ai/${url}`;
  // 주의: User-Agent를 명시하면 Jina가 403을 반환하는 경우가 있음.
  // 기본 Node fetch UA(node) 또는 무헤더가 통과율이 가장 높음.
  const headers = {};
  if (process.env.JINA_API_KEY) {
    headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
  }
  const res = await fetchWithTimeout(jinaUrl, { headers, timeout: 20000 });
  if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
  const markdown = await res.text();

  if (!markdown || markdown.length < 200) {
    throw new Error('Jina 응답이 너무 짧습니다 (본문 추출 실패 가능성)');
  }

  // Jina 출력 포맷 파싱
  const titleMatch = markdown.match(/^Title:\s*(.+)$/m);
  const urlMatch = markdown.match(/^URL Source:\s*(.+)$/m);
  const publishedMatch = markdown.match(/^Published Time:\s*(.+)$/m);
  const contentStart = markdown.indexOf('Markdown Content:');
  const content = contentStart >= 0 ? markdown.slice(contentStart + 'Markdown Content:'.length).trim() : markdown;

  // 이미지 추출
  const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
  const images = [];
  let m;
  while ((m = imgRegex.exec(content)) !== null) {
    const imgUrl = m[1].split(' ')[0]; // markdown image may have title after url
    if (imgUrl && !images.includes(imgUrl) && !imgUrl.startsWith('data:')) {
      images.push(imgUrl);
    }
  }

  // 텍스트 정규화
  const text = content
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')     // 이미지 제거
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // 링크 → 텍스트
    .replace(/^#+\s*/gm, '')                    // 헤딩 기호 제거
    .replace(/^\s*[-*]\s+/gm, '• ')            // 리스트 마커
    .replace(/\n{3,}/g, '\n\n')                // 연속 개행 축소
    .trim();

  if (text.length < 300) {
    throw new Error('본문 추출 결과가 너무 짧습니다 (JS 렌더링·로그인·차단 페이지 가능성)');
  }

  // blocks: 이미지-텍스트 순서 추정 (Jina는 이미지가 상단에 몰려있는 경우가 많음)
  const blocks = [];
  if (text) blocks.push({ type: 'text', text });
  for (const src of images) blocks.push({ type: 'image', src });

  return {
    title: titleMatch ? titleMatch[1].trim() : '',
    body: text,
    blocks,
    images,
    thumbnail: images[0] || null,
    description: '',
    author: '',
    publishedAt: publishedMatch ? publishedMatch[1].trim() : '',
    sourceUrl: url,
    extractor: 'jina',
  };
}

/**
 * URL에서 기사 추출 (네이버 → Jina → 에러)
 * @returns {Promise<Article>}
 */
export async function extractFromUrl(url) {
  if (!url || typeof url !== 'string') {
    throw Object.assign(new Error('유효한 URL을 입력해주세요.'), { code: 'INVALID_URL' });
  }
  const normalized = url.trim();

  // URL 유효성 간단 체크
  try {
    new URL(normalized);
  } catch {
    throw Object.assign(new Error('올바른 URL 형식이 아닙니다.'), { code: 'INVALID_URL' });
  }

  // 배민 사장님 매거진 — 전용 API 사용 (iframe SPA 우회)
  if (isBaeminCeoUrl(normalized)) {
    try {
      return await extractBaeminCeo(normalized);
    } catch (e) {
      console.warn('[extractor] baemin ceo failed, fallback to jina:', e.message);
      // fall through to Jina
    }
  }

  // 네이버 블로그
  if (isNaverBlogUrl(normalized)) {
    try {
      return await extractNaverBlog(normalized);
    } catch (e) {
      console.warn('[extractor] naver blog failed, fallback to readability:', e.message);
      // fall through
    }
  }

  // Readability 폴백 (일반 SSR 사이트)
  try {
    return await extractViaReadability(normalized);
  } catch (e) {
    console.warn('[extractor] readability failed, fallback to jina:', e.message);
    // fall through
  }

  // Jina Reader 최종 폴백 (SPA/렌더링 필요 사이트)
  try {
    return await extractViaJina(normalized);
  } catch (e) {
    throw Object.assign(
      new Error(`자동 추출에 실패했습니다. 본문을 직접 붙여넣어 주세요. (${e.message})`),
      { code: 'EXTRACTION_FAILED', cause: e.message }
    );
  }
}

/**
 * 직접 붙여넣은 텍스트를 정규화
 * @param {string} rawText
 * @param {{ title?: string, sourceUrl?: string }} options
 * @returns {Article}
 */
export function extractFromText(rawText, options = {}) {
  if (!rawText || typeof rawText !== 'string') {
    throw Object.assign(new Error('본문을 입력해주세요.'), { code: 'EMPTY_BODY' });
  }
  const text = rawText.trim();
  if (text.length < 50) {
    throw Object.assign(new Error('본문이 너무 짧습니다 (최소 50자)'), { code: 'BODY_TOO_SHORT' });
  }

  const firstLine = text.split('\n').map(s => s.trim()).find(Boolean) || '';
  const title = options.title || firstLine.slice(0, 80);
  // 첫 줄을 제목으로 썼다면 본문에서 제외 (유저가 제목까지 포함해 붙여넣은 경우 자연스럽게)
  const body = (!options.title && firstLine && firstLine.length <= 80 && firstLine !== text)
    ? text.slice(firstLine.length).trim()
    : text;

  return {
    title,
    body,
    blocks: [{ type: 'text', text: body }],
    images: [],
    thumbnail: null,
    description: '',
    author: '',
    sourceUrl: options.sourceUrl || null,
    extractor: 'manual',
  };
}
