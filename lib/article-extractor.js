// 웹 아티클 본문 추출기
// 1차: 네이버 블로그 전용 파서 (m.blog.naver.com + se-main-container)
// 2차: Jina Reader 폴백 (https://r.jina.ai/{url})
// 3차: 수동 붙여넣기 정규화

import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import { ProxyAgent } from 'undici';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// YT_PROXY 환경변수에서 Webshare 프록시 리스트 로드 (쉼표 구분 URL 리스트)
// 배민처럼 Railway IP를 차단하는 사이트에 proxy 경유 요청 (기존 YouTube 다운로드와 동일 풀 재사용)
function getProxyUrls() {
  const raw = process.env.YT_PROXY || '';
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function getProxyUrlVariants(proxyUrl) {
  const variants = [proxyUrl];
  let parsed;
  try {
    parsed = new URL(proxyUrl);
  } catch {
    return variants;
  }
  if (!parsed.username || !parsed.password || !/webshare\.io$/i.test(parsed.hostname)) {
    return variants;
  }

  const username = decodeURIComponent(parsed.username);
  const numbered = username.match(/^(.+)-(\d+)$/);
  const countryCodes = ['kr', 'jp', 'us'];
  for (const country of countryCodes) {
    if (numbered) {
      const withCountryAndSession = new URL(parsed.toString());
      withCountryAndSession.username = `${numbered[1]}-${country}-${numbered[2]}`;
      variants.push(withCountryAndSession.toString());

      const withCountryOnly = new URL(parsed.toString());
      withCountryOnly.username = `${numbered[1]}-${country}`;
      variants.push(withCountryOnly.toString());
    }

    const appended = new URL(parsed.toString());
    appended.username = `${username}-${country}`;
    variants.push(appended.toString());
  }
  return [...new Set(variants)];
}

function expandProxyUrls(proxyUrls) {
  return [...new Set(proxyUrls.flatMap(getProxyUrlVariants))];
}

const webshareProxyCache = new Map();
async function fetchWebshareProxyUrls(countryCode) {
  const apiKey = process.env.WEBSHARE_API_KEY;
  if (!apiKey) return [];
  const cacheKey = countryCode || 'any';
  const cached = webshareProxyCache.get(cacheKey);
  if (cached && Date.now() - cached.t < 10 * 60 * 1000) return cached.urls;

  try {
    const qs = countryCode ? `&country_code=${encodeURIComponent(countryCode)}` : '';
    const res = await fetchWithTimeout(
      `https://proxy.webshare.io/api/v2/proxy/list/?mode=direct${qs}&page_size=5`,
      { headers: { Authorization: `Token ${apiKey}` }, timeout: 10000 }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const urls = (data.results || [])
      .map(p => `http://${p.username}:${p.password}@${p.proxy_address}:${p.port}`)
      .filter(Boolean);
    webshareProxyCache.set(cacheKey, { t: Date.now(), urls });
    return urls;
  } catch {
    return [];
  }
}

async function tryProxyUrls(targetUrl, baseOpts, proxyUrls, errors) {
  for (const proxyUrl of proxyUrls) {
    try {
      const agent = new ProxyAgent(proxyUrl);
      const r = await fetchWithTimeout(targetUrl, { ...baseOpts, dispatcher: agent });
      if (r.ok) return r;
      errors.push(`proxy HTTP ${r.status}`);
    } catch (e) {
      errors.push(`proxy network ${e.message}`);
    }
  }
  return null;
}

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 15000;
const IMAGE_FETCH_MAX_BYTES = 25 * 1024 * 1024;
const CHROMIUM_CANDIDATES = [
  process.env.CHROMIUM_PATH,
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);

function isNaverBlogUrl(url) {
  return /^https?:\/\/(m\.)?blog\.naver\.com\//.test(url);
}

function toMobileNaverUrl(url) {
  return url.replace(/^(https?:\/\/)blog\.naver\.com/, '$1m.blog.naver.com');
}

// /knowhow/, /guide/, /notice/ 모두 동일 API(seq 기반)로 조회 가능 — type=USAGE 고정.
const BAEMIN_CEO_REGEX = /^https?:\/\/(www\.)?ceo\.baemin\.com\/(?:knowhow|guide|notice)\/(\d+)/;
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

// direct → proxy 재시도 헬퍼.
// 차단 응답(!res.ok)도 네트워크 에러와 동급으로 취급해서 proxy 재시도해야 함 —
// Railway outbound IP가 막힌 사이트는 fetch가 성공하지만 403/404를 돌려보내기 때문.
// generate-cards-from-article 등 외부에서도 같은 차단 우회가 필요해 export.
export async function fetchDirectThenProxy(targetUrl, baseOpts, label) {
  async function tryOnce(opts) {
    try {
      const r = await fetchWithTimeout(targetUrl, opts);
      return r.ok ? { ok: true, res: r } : { ok: false, err: `HTTP ${r.status}` };
    } catch (e) {
      return { ok: false, err: `network ${e.message}` };
    }
  }

  const direct = await tryOnce(baseOpts);
  if (direct.ok) return direct.res;

  const proxyErrors = [];
  const staticProxyUrls = getProxyUrls();
  if (staticProxyUrls.length > 0) {
    console.warn(`[extractor] ${label} direct ${direct.err} — retrying via configured proxy`);
    const proxied = await tryProxyUrls(targetUrl, baseOpts, expandProxyUrls(staticProxyUrls), proxyErrors);
    if (proxied) return proxied;
  }

  // Railway IP가 막히는 이미지 CDN은 YT_PROXY가 비어 있어도 WEBSHARE_API_KEY만
  // 설정되어 있는 환경이 있을 수 있다. YouTube 워커의 geo-proxy와 같은 풀을
  // 즉석 조회해서 한 번 더 시도한다.
  for (const country of ['KR', 'US', 'JP']) {
    const dynamicProxyUrls = await fetchWebshareProxyUrls(country);
    if (dynamicProxyUrls.length === 0) continue;
    console.warn(`[extractor] ${label} direct ${direct.err} — retrying via Webshare ${country}`);
    const proxied = await tryProxyUrls(targetUrl, baseOpts, dynamicProxyUrls, proxyErrors);
    if (proxied) return proxied;
  }

  const proxyMsg = proxyErrors.length > 0 ? ` / proxy ${proxyErrors.slice(-3).join(', ')}` : ' (no proxy configured)';
  throw new Error(`${label} direct ${direct.err}${proxyMsg}`);
}

export function detectImageContentType(buffer, fallback = 'image/jpeg') {
  if (!buffer || buffer.length < 12) return fallback;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return 'image/gif';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return fallback;
}

function headerEntries(headers = {}) {
  return Object.entries(headers || {})
    .filter(([, v]) => v != null && String(v).length > 0)
    .map(([k, v]) => [k, String(v)]);
}

function withoutHeaders(headers, removeNames) {
  const remove = new Set(removeNames.map(n => n.toLowerCase()));
  return Object.fromEntries(headerEntries(headers).filter(([k]) => !remove.has(k.toLowerCase())));
}

function uniqueHeaderVariants(variants) {
  const seen = new Set();
  return variants.filter(headers => {
    const key = JSON.stringify(headerEntries(headers).sort(([a], [b]) => a.localeCompare(b)));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildImageHeaderVariants(baseHeaders = {}) {
  const noReferer = withoutHeaders(baseHeaders, ['referer', 'origin']);
  return uniqueHeaderVariants([
    baseHeaders,
    noReferer,
    {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
    {
      'User-Agent': 'curl/8.0.0',
      'Accept': '*/*',
    },
  ]);
}

async function fetchImageWithCurlOnce(targetUrl, headers, timeoutMs, forceHttp1) {
  const seconds = Math.max(3, Math.ceil(timeoutMs / 1000));
  const args = [
    '-L',
    '--fail',
    '--silent',
    '--show-error',
    '--compressed',
    '--connect-timeout', '10',
    '--max-time', String(seconds),
    '--max-filesize', String(IMAGE_FETCH_MAX_BYTES),
  ];
  if (forceHttp1) args.push('--http1.1');
  for (const [k, v] of headerEntries(headers)) {
    args.push('-H', `${k}: ${v}`);
  }
  args.push(targetUrl);

  const { stdout } = await execFileAsync('curl', args, {
    encoding: 'buffer',
    maxBuffer: IMAGE_FETCH_MAX_BYTES + 1024 * 1024,
    timeout: timeoutMs + 5000,
  });
  const buffer = Buffer.from(stdout);
  if (!buffer.length) throw new Error('empty response');
  return buffer;
}

function findChromiumExecutable() {
  return CHROMIUM_CANDIDATES.find(p => existsSync(p)) || null;
}

function escapeAttr(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export async function fetchImageWithBrowserScreenshot(targetUrl, timeoutMs, label) {
  const executablePath = findChromiumExecutable();
  if (!executablePath) throw new Error('chromium executable not found');

  const { chromium } = await import('playwright-core');
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
  try {
    async function newImagePage() {
      return browser.newPage({
        viewport: { width: 1600, height: 1600 },
        userAgent: BROWSER_UA,
      });
    }

    async function screenshotLoadedImage(page, imgSelector, mode) {
      await page.waitForFunction((selector) => {
        const img = document.querySelector(selector);
        return img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
      }, imgSelector, { timeout: timeoutMs });

      const dim = await page.evaluate((selector) => {
        const img = document.querySelector(selector);
        return { width: img.naturalWidth, height: img.naturalHeight };
      }, imgSelector);
      const maxDim = 2400;
      const scale = Math.min(1, maxDim / Math.max(dim.width, dim.height));
      const width = Math.max(1, Math.round(dim.width * scale));
      const height = Math.max(1, Math.round(dim.height * scale));
      await page.setViewportSize({ width, height });
      await page.evaluate(({ selector, width, height }) => {
        document.documentElement.style.margin = '0';
        document.documentElement.style.padding = '0';
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';
        const img = document.querySelector(selector);
        img.style.display = 'block';
        img.style.width = `${width}px`;
        img.style.height = `${height}px`;
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
      }, { selector: imgSelector, width, height });

      const buffer = await page.locator(imgSelector).screenshot({ type: 'png', timeout: timeoutMs });
      if (!buffer?.length) throw new Error('empty screenshot');
      console.warn(`[extractor] ${label} fetch fallback succeeded via browser ${mode} screenshot (image/png, ${buffer.length} bytes, ${width}x${height})`);
      return buffer;
    }

    const errors = [];

    const page = await newImagePage();
    try {
      const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}img{display:block;width:auto;height:auto;max-width:none;max-height:none}</style><img id="img" src="${escapeAttr(targetUrl)}" referrerpolicy="no-referrer">`;
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      return await screenshotLoadedImage(page, '#img', 'embedded');
    } catch (e) {
      errors.push(`embedded ${e.message}`);
    } finally {
      await page.close().catch(() => {});
    }

    const navPage = await newImagePage();
    try {
      const resp = await navPage.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      if (resp && !resp.ok()) throw new Error(`navigation HTTP ${resp.status()}`);
      return await screenshotLoadedImage(navPage, 'img', 'navigation');
    } catch (e) {
      errors.push(`navigation ${e.message}`);
    } finally {
      await navPage.close().catch(() => {});
    }

    throw new Error(errors.join(' / '));
  } finally {
    await browser.close().catch(() => {});
  }
}

// 이미지 CDN은 Node/undici, Railway IP, 일반 프록시 중 한 조합만 막히는 경우가 있다.
// fetch/proxy가 모두 실패하면 같은 컨테이너의 curl과 headless Chromium screenshot으로 한 번 더 받는다.
export async function fetchImageBufferDirectThenProxy(targetUrl, baseOpts = {}, label = 'image') {
  let fetchErr = null;
  try {
    const resp = await fetchDirectThenProxy(targetUrl, baseOpts, label);
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (!buffer.length) throw new Error(`${label} empty image response`);
    const headerType = (resp.headers.get('content-type') || '').split(';')[0].trim();
    return {
      buffer,
      contentType: detectImageContentType(buffer, headerType || 'image/jpeg'),
      via: 'fetch',
    };
  } catch (e) {
    fetchErr = e;
  }

  const timeoutMs = Math.min(baseOpts.timeout || FETCH_TIMEOUT_MS, 30000);
  const errors = [];
  for (const headers of buildImageHeaderVariants(baseOpts.headers || {})) {
    for (const forceHttp1 of [false, true]) {
      try {
        const buffer = await fetchImageWithCurlOnce(targetUrl, headers, timeoutMs, forceHttp1);
        const contentType = detectImageContentType(buffer);
        console.warn(`[extractor] ${label} fetch fallback succeeded via curl${forceHttp1 ? ' http1.1' : ''} (${contentType}, ${buffer.length} bytes)`);
        return { buffer, contentType, via: 'curl' };
      } catch (e) {
        errors.push(`curl${forceHttp1 ? '/http1.1' : ''} ${e.message}`);
      }
    }
  }

  try {
    const buffer = await fetchImageWithBrowserScreenshot(targetUrl, timeoutMs, label);
    return { buffer, contentType: 'image/png', via: 'browser' };
  } catch (e) {
    errors.push(`browser ${e.message}`);
  }

  const curlMsg = errors.length > 0 ? ` / ${errors.slice(-3).join(', ')}` : '';
  throw new Error(`${fetchErr?.message || `${label} fetch failed`}${curlMsg}`);
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
  // Baemin API는 Node fetch의 풀 Chrome UA + Accept-Encoding 조합을 봇으로 감지해 403.
  // 실측 결과: "Mozilla/5.0" 최소 UA만 보내면 200 (로컬 기준).
  // Railway outbound IP는 fetch 성공 + 403 응답 형태로 차단되므로,
  // fetchDirectThenProxy로 차단 응답까지 잡아서 proxy 재시도.
  const baseOpts = { headers: { 'User-Agent': 'Mozilla/5.0' } };
  const res = await fetchDirectThenProxy(apiUrl, baseOpts, '배민 API');
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
  const apiKey = process.env.JINA_API_KEY;
  const hasKey = !!apiKey;
  if (hasKey) {
    // 유료 기능 활성화 (무료 크레딧 1M 토큰부터 시작)
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-With-Iframe'] = 'true';          // SPA iframe 내부 콘텐츠 처리 (배민·Notion 등)
    headers['X-Return-Format'] = 'markdown';    // 구조화된 출력
    headers['X-Timeout'] = '25';                // JS 렌더링 대기 (기본 5초 → 25초)
  }
  // 유료 키 있으면 더 긴 timeout 허용
  const timeout = hasKey ? 35000 : 20000;
  const baseOpts = { headers, timeout };
  const res = await fetchDirectThenProxy(jinaUrl, baseOpts, 'Jina');
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

  // 배민 사장님 매거진 — 전용 API 우선, 실패 시 Jina 폴백
  // 직접 API가 Railway outbound IP 차단으로 실패할 수 있음 → Jina(X-With-Iframe)로 재시도
  if (isBaeminCeoUrl(normalized)) {
    try {
      return await extractBaeminCeo(normalized);
    } catch (e) {
      console.warn('[extractor] baemin ceo failed, fallback to jina:', e.message);
      try {
        return await extractViaJina(normalized);
      } catch (e2) {
        throw Object.assign(
          new Error(`배민 매거진 추출 실패: ${e.message} / Jina: ${e2.message}`),
          { code: 'BAEMIN_API_FAILED', cause: e.message }
        );
      }
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
