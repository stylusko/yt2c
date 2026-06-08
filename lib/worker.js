import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { getTempPath, getOutputPath, cleanup } from './storage.js';
import { uploadFile, makeBucketKey } from './bucket.js';

const execFileAsync = promisify(execFile);

// --- YouTube Auth ---
// Cookies + bgutil PO Token plugin (자동)

const COOKIE_PATH = '/tmp/yt-cookies.txt';
let cookieReady = false;

// --- Proxy Rotation ---
let proxyList = [];
let proxyIndex = 0;

function loadProxies() {
  const raw = process.env.YT_PROXY || '';
  proxyList = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (proxyList.length > 0) {
    console.log(`[proxy] ${proxyList.length}개 프록시 로드됨`);
  }
}

function getNextProxy() {
  if (proxyList.length === 0) return null;
  const proxy = proxyList[proxyIndex % proxyList.length];
  proxyIndex++;
  return proxy;
}

// --- Geo-block: 국가명 → 국가코드 매핑 ---
const COUNTRY_NAME_TO_CODE = {
  'korea, republic of': 'KR', 'south korea': 'KR', 'korea': 'KR',
  'japan': 'JP', 'united states': 'US', 'united kingdom': 'GB',
  'china': 'CN', 'taiwan': 'TW', 'germany': 'DE', 'france': 'FR',
  'canada': 'CA', 'australia': 'AU', 'india': 'IN', 'brazil': 'BR',
  'mexico': 'MX', 'spain': 'ES', 'italy': 'IT', 'russia': 'RU',
  'thailand': 'TH', 'vietnam': 'VN', 'indonesia': 'ID',
  'philippines': 'PH', 'malaysia': 'MY', 'singapore': 'SG',
};

function parseGeoCountries(stderr) {
  const matches = [...stderr.matchAll(/available in ([^.\n]+)/gi)];
  if (matches.length === 0) return [];
  const countries = [];
  for (const m of matches) {
    const name = m[1].trim().toLowerCase();
    const code = COUNTRY_NAME_TO_CODE[name];
    if (code && !countries.includes(code)) countries.push(code);
  }
  return countries;
}

// Webshare API로 특정 국가 프록시 조회
async function fetchGeoProxies(countryCode) {
  const apiKey = process.env.WEBSHARE_API_KEY;
  if (!apiKey) {
    console.warn(`  [geo-proxy] WEBSHARE_API_KEY 미설정, 국가별 프록시 조회 불가`);
    return [];
  }
  try {
    console.log(`  [geo-proxy] Webshare API에서 ${countryCode} 프록시 조회 중...`);
    const res = await fetch(
      `https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&country_code=${countryCode}&page_size=5`,
      { headers: { Authorization: `Token ${apiKey}` }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) {
      console.warn(`  [geo-proxy] Webshare API 응답 실패: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const proxies = (data.results || []).map(p =>
      `http://${p.username}:${p.password}@${p.proxy_address}:${p.port}`
    );
    console.log(`  [geo-proxy] ${countryCode} 프록시 ${proxies.length}개 확보`);
    return proxies;
  } catch (e) {
    console.warn(`  [geo-proxy] Webshare API 오류: ${e.message}`);
    return [];
  }
}
function ensureCookieFile() {
  if (cookieReady) return;
  cookieReady = true;
  const b64 = process.env.YT_COOKIES_B64;
  const plain = process.env.YT_COOKIES;
  if (b64) {
    fs.writeFileSync(COOKIE_PATH, Buffer.from(b64, 'base64').toString('utf-8'));
    console.log('[auth] Cookies written (base64)');
  } else if (plain) {
    fs.writeFileSync(COOKIE_PATH, plain, 'utf-8');
    console.log('[auth] Cookies written (plain)');
  }
}

/**
 * Parse time string ("1:10", "3:42:15", "90") to seconds
 */
function parseTimeToSeconds(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const parts = String(str).trim().split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

/**
 * Convert seconds to HH:MM:SS(.s) format
 */
function secondsToTime(seconds) {
  const total = Math.max(0, Math.round((Number(seconds) || 0) * 10) / 10);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total - hours * 3600) / 60);
  const secs = total - hours * 3600 - minutes * 60;
  const secText = secs.toFixed(1).replace(/\.0$/, '').padStart(2, '0');
  return [hours, minutes, secText].map((v, idx) => idx < 2 ? String(v).padStart(2, '0') : v).join(':');
}

/**
 * Builds FFmpeg filter chain for cropping video to target dimensions
 * @param {number} vw - source video width
 * @param {number} vh - source video height
 * @param {number} outW - target output width
 * @param {number} outH - target output height
 * @param {number[]} videoPos - [x%, y%] position
 * @param {number} videoScale - zoom percentage
 * @param {string} videoFill - "full" or "split"
 * @param {string} layout - "photo_top", "photo_bottom", or "text_overlay"
 * @param {number} photoRatio - ratio of photo area (0-1) or percent (0-100)
 * @param {boolean} clampCoverZoom - keep cover-fit sources at least 101% scale
 */
function buildFilterChain(vw, vh, outW, outH, videoPos, videoScale, videoFill, layout, photoRatio, videoBrightness, fitMode, clampCoverZoom = true) {
  const [rawX, rawY] = videoPos || [0, 0];
  const zoom = Math.max((videoScale ?? 100), 1) / 100; // min 1% to avoid zero
  const coverZoom = clampCoverZoom ? Math.max(zoom, 1.01) : zoom; // 영상은 가장자리 보간 방지, 이미지는 프리뷰 scale 그대로
  const aspect = vw / vh;
  const bright = (videoBrightness || 0) / 100; // -0.5 to +0.5
  const eqFilter = bright !== 0 ? `,eq=brightness=${bright.toFixed(2)}` : '';
  // Clamp photoRatio to valid range. Frontend stores percent (55), older API callers may send ratio (0.55).
  const rawPhotoRatio = Number(photoRatio);
  photoRatio = Number.isFinite(rawPhotoRatio) && rawPhotoRatio > 0
    ? (rawPhotoRatio > 1 ? rawPhotoRatio / 100 : rawPhotoRatio)
    : 0.55;
  photoRatio = Math.max(0.1, Math.min(0.95, photoRatio));
  // Ensure even dimensions for yuv420p compatibility
  const even = (n) => Math.round(n / 2) * 2;

  // 프론트엔드 오프셋 공식과 동일하게 픽셀 위치 계산 (음수/화면 밖 위치 지원)
  // Frontend: offX = scaledW * videoX / 400 + (scaledW - targetW) / 2
  // → videoLeft = -offX = (targetW - scaleW) / 2 - scaleW * videoX / 400
  function computePixelPos(rawVal, scaleD, targetD) {
    return Math.round((targetD - scaleD) / 2 - scaleD * (rawVal ?? 0) / 400);
  }

  function buildVideoFilter(scaleW, scaleH, targetW, targetH) {
    const posX = computePixelPos(rawX, scaleW, targetW);
    const posY = computePixelPos(rawY, scaleH, targetH);
    // format=yuv420p를 scale/overlay 이후에 적용:
    // 먼저 검정 배경 위에 합성해서 알파를 제대로 처리한 뒤 yuv420p로 변환.
    // (순서 반대일 경우 WebP/PNG 투명 픽셀의 RGB값이 그대로 노출돼 초록 배경 발생)
    // 프리뷰는 이미지/영상 DOM을 검정 카드 위에 그대로 배치하므로, 소스가 카드보다 커도
    // 위치를 클램프하지 않는다. FFmpeg에서도 같은 방식으로 overlay해야 슬라이더로
    // 일부러 만든 검정 여백이 최종 출력에 그대로 남는다.
    return `[0:v]scale=${scaleW}:${scaleH}${eqFilter}[sv];color=black:${targetW}x${targetH},format=yuv420p[bg];[bg][sv]overlay=${posX}:${posY}:shortest=1,format=yuv420p`;
  }

  if (videoFill === 'split' && layout !== 'text_overlay' && layout !== 'none') {
    // 분리형: 영상은 영상 영역에만 배치
    const textH = Math.round(outH * (1 - (photoRatio || 0.55)));
    const videoH = outH - textH;
    const videoY = layout === 'photo_top' ? 0 : textH;

    const videoAspect = outW / videoH;
    let scaleW, scaleH;
    const splitContain = fitMode === 'contain';
    const sz = splitContain ? zoom : coverZoom;
    if (splitContain ? (aspect >= videoAspect) : (aspect < videoAspect)) {
      scaleW = even(Math.round(outW * sz));
      scaleH = even(Math.round(scaleW / aspect));
    } else {
      scaleH = even(Math.round(videoH * sz));
      scaleW = even(Math.round(scaleH * aspect));
    }

    const vf = buildVideoFilter(scaleW, scaleH, outW, videoH);
    return `${vf},pad=${outW}:${outH}:0:${videoY}:black[scaled];[1:v]format=yuva420p[ov];[scaled][ov]overlay=0:0`;
  }

  // 전체 채우기
  let scaleW, scaleH;
  const outAspect = outW / outH;
  const useContain = fitMode === 'contain';
  const fz = useContain ? zoom : coverZoom;
  if (useContain ? (aspect >= outAspect) : (aspect < outAspect)) {
    scaleW = even(Math.round(outW * fz));
    scaleH = even(Math.round(scaleW / aspect));
  } else {
    scaleH = even(Math.round(outH * fz));
    scaleW = even(Math.round(scaleH * aspect));
  }

  const vf = buildVideoFilter(scaleW, scaleH, outW, outH);
  return `${vf}[scaled];[1:v]format=yuva420p[ov];[scaled][ov]overlay=0:0`;
}

/**
 * Validates downloaded video file integrity using ffprobe.
 * Returns true if the file is a valid, playable video; false otherwise.
 */
async function validateVideoFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return false;
    const stat = fs.statSync(filePath);
    if (stat.size < 1024) return false; // 1KB 미만은 확실히 깨진 파일
    await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=s=x:p=0',
      filePath,
    ], { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets video dimensions using ffprobe
 */
async function getVideoDimensions(videoPath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'csv=s=x:p=0',
    videoPath,
  ]);
  const [width, height] = stdout.trim().split('x').map(Number);
  if (!width || !height) throw new Error('Could not determine video dimensions');
  return { width, height };
}

/**
 * Downloads YouTube video segment
 */
async function downloadYouTubeSegment(url, startSec, endSec, outputPath, onStatusMessage) {
  const startTime = secondsToTime(startSec);
  const endTime = secondsToTime(endSec);

  console.log(`  yt-dlp: downloading ${startTime} - ${endTime}`);

  ensureCookieFile();
  if (proxyList.length === 0) loadProxies();

  const baseArgs = [
    '--download-sections', `*${startTime}-${endTime}`,
    // AV1(av01) 코덱은 libdav1d 디코드 메모리가 커서 Railway 컨테이너에서 'Cannot allocate
    // memory'로 실패하고 결과물이 검정으로 떨어짐. AVC1/VP9만 받도록 vcodec 필터 추가.
    // 폴백: AV1 외 1080p 없으면 720p, 그것도 없으면 형식 무관 best (메모리 위험은 감수).
    '-f', 'bestvideo[height<=1080][vcodec!*=av01]+bestaudio/bestvideo[height<=720]+bestaudio/best[height<=1080]',
    '--force-keyframes-at-cuts',
    '--merge-output-format', 'mp4',
    '--js-runtimes', 'node',
    '--remote-components', 'ejs:github',
    '-o', outputPath,
    '--no-playlist',
  ];

  // Cookies
  if (fs.existsSync(COOKIE_PATH)) {
    baseArgs.push('--cookies', COOKIE_PATH);
  }

  // PO Token: bgutil 플러그인이 자동 처리 (별도 설정 불필요)

  baseArgs.push(url);

  const hasCookies = fs.existsSync(COOKIE_PATH);
  const authInfo = {
    cookies: hasCookies,
    poToken: true, // bgutil 플러그인 항상 활성
    proxy: false,
    directFailReason: null, // 1차(직접) 실패 사유
  };

  // 1단계: 프록시 없이 시도 (쿠키 + PO Token만)
  console.log(`  yt-dlp: 1차 시도 (프록시 없이)`);
  try {
    await execFileAsync('yt-dlp', [...baseArgs], { timeout: 180000 });
    // 다운로드 성공해도 파일 무결성 검증
    if (!await validateVideoFile(outputPath)) {
      throw Object.assign(new Error('Downloaded file is corrupted'), { stderr: 'moov atom not found / invalid video' });
    }
    return authInfo; // 성공
  } catch (err) {
    const stderr = err.stderr || '';
    const isBot = stderr.includes('Sign in') || stderr.includes('confirm you') || stderr.includes('bot');
    const is403 = stderr.includes('403') || stderr.includes('Forbidden');
    const isNetwork = stderr.includes('HTTP error') || stderr.includes('urlopen error') || stderr.includes('timed out');
    const isCorrupt = stderr.includes('moov atom') || stderr.includes('invalid video');
    const isGeoBlock = stderr.includes('not made this video available in your country');

    if (isGeoBlock) {
      const geoCountries = parseGeoCountries(stderr);
      authInfo.directFailReason = '지역제한';
      const regionLabel = geoCountries.length > 0 ? geoCountries.join(', ') : '알 수 없음';
      console.warn(`  yt-dlp: 1차 실패 (지역제한), 허용 지역: ${regionLabel}`);
      if (onStatusMessage) onStatusMessage(`지역 제한 영상이라 평소보다 시간이 걸려요`);
      try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}

      // 지역제한: 해당 국가 프록시 우선 시도
      if (geoCountries.length > 0) {
        const geoProxies = await fetchGeoProxies(geoCountries[0]);
        if (geoProxies.length > 0) {
          console.log(`  yt-dlp: ${geoCountries[0]} 전용 프록시 ${geoProxies.length}개로 시도`);
          for (let i = 0; i < geoProxies.length; i++) {
            const args = [...baseArgs];
            const urlIdx = args.indexOf(url);
            args.splice(urlIdx, 0, '--proxy', geoProxies[i]);
            console.log(`  yt-dlp: ${geoCountries[0]} 프록시 ${i + 1}/${geoProxies.length}: ${geoProxies[i].replace(/\/\/.*@/, '//***@')}`);
            try {
              await execFileAsync('yt-dlp', args, { timeout: 180000 });
              if (!await validateVideoFile(outputPath)) {
                throw Object.assign(new Error('Downloaded file is corrupted (geo-proxy)'), { stderr: 'moov atom not found / invalid video' });
              }
              authInfo.proxy = true;
              console.log(`  yt-dlp: ${geoCountries[0]} 프록시로 다운로드 성공!`);
              return authInfo;
            } catch (geoErr) {
              console.warn(`  yt-dlp: ${geoCountries[0]} 프록시 ${i + 1} 실패: ${(geoErr.message || '').slice(0, 80)}`);
              try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}
            }
          }
          console.warn(`  yt-dlp: ${geoCountries[0]} 전용 프록시 모두 실패, 일반 프록시로 전환...`);
        }
      }

      // 전용 프록시 실패 또는 없음 → 일반 프록시로 폴백
      if (proxyList.length === 0) {
        throw Object.assign(new Error(`이 영상은 지역 제한(${geoCountries.join(', ') || '알 수 없음'})으로 다운로드할 수 없습니다.`), { stderr: err.stderr });
      }
    } else if ((isBot || is403 || isNetwork || isCorrupt) && proxyList.length > 0) {
      const reason = isBot ? 'bot감지' : is403 ? '403' : isCorrupt ? '파일손상' : 'network';
      authInfo.directFailReason = reason;
      console.warn(`  yt-dlp: 1차 실패 (${reason}), 프록시로 전환...`);
      try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}
    } else {
      throw err; // 프록시 없거나 다른 종류 에러 → 즉시 실패
    }
  }

  // 2단계: 일반 프록시 로테이션 (지역제한 전용 프록시 실패 시 폴백 포함)
  const maxProxyAttempts = Math.min(proxyList.length, 5);
  const retryDelayMs = 5000;
  let lastErr;

  for (let attempt = 1; attempt <= maxProxyAttempts; attempt++) {
    const args = [...baseArgs];
    const urlIdx = args.indexOf(url);
    const proxy = getNextProxy();
    if (proxy) {
      args.splice(urlIdx, 0, '--proxy', proxy);
      console.log(`  yt-dlp: 일반 프록시 ${attempt}/${maxProxyAttempts}: ${proxy.replace(/\/\/.*@/, '//***@')}`);
    }

    try {
      await execFileAsync('yt-dlp', args, { timeout: 180000 });
      // 프록시 다운로드도 파일 무결성 검증
      if (!await validateVideoFile(outputPath)) {
        throw Object.assign(new Error('Downloaded file is corrupted (proxy)'), { stderr: 'moov atom not found / invalid video' });
      }
      authInfo.proxy = true;
      return authInfo; // 성공
    } catch (err) {
      lastErr = err;
      const stderr = err.stderr || '';
      const isBot = stderr.includes('Sign in') || stderr.includes('confirm you') || stderr.includes('bot');
      const is403 = stderr.includes('403') || stderr.includes('Forbidden');
      const isNetwork = stderr.includes('HTTP error') || stderr.includes('urlopen error') || stderr.includes('timed out');
      const isProxyErr = stderr.includes('proxy') || stderr.includes('CONNECT');
      const isCorrupt = stderr.includes('moov atom') || stderr.includes('invalid video');

      if ((isBot || is403 || isNetwork || isProxyErr || isCorrupt) && attempt < maxProxyAttempts) {
        const reason = isBot ? 'bot감지' : is403 ? '403' : isCorrupt ? '파일손상' : isProxyErr ? '프록시오류' : 'network';
        console.warn(`  yt-dlp: 일반 프록시 ${attempt} 실패 (${reason}), 다음 프록시...`);
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}
        await new Promise(r => setTimeout(r, retryDelayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Gets image dimensions using ffprobe
 */
async function getImageDimensions(imagePath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'csv=s=x:p=0',
    imagePath,
  ]);
  const [width, height] = stdout.trim().split('x').map(Number);
  if (!width || !height) throw new Error('Could not determine image dimensions');
  return { width, height };
}

export { ensureCookieFile, downloadYouTubeSegment, getVideoDimensions };

export async function processCard({
  jobId,
  cardConfig,
  url,
  cardIdx,
  overlayPath,
  backgroundPath,
  outputFormat = 'mp4',
  outputSize = 1080,
  onStatusMessage,
}) {
  const useImageBg = !!backgroundPath;

  // Parse time strings to seconds
  const startSec = parseTimeToSeconds(cardConfig.start);
  const endSec = parseTimeToSeconds(cardConfig.end);

  if (!useImageBg && endSec <= startSec) {
    throw new Error(`Invalid time range: ${cardConfig.start} - ${cardConfig.end}`);
  }

  // Setup paths
  const downloadedVideo = getTempPath(jobId, `segment_${cardIdx}.mp4`);
  const ext = outputFormat === 'jpg' || outputFormat === 'image' ? 'jpg' : 'mp4';
  const outputPath = getOutputPath(`${jobId}_${cardIdx}`, ext);

  try {
    let authInfo = null;

    // Compute output dimensions based on aspect ratio
    const ar = cardConfig.aspect_ratio || '1:1';
    const [aw, ah] = ar.split(':').map(Number);
    const outW = (aw && ah && aw > ah) ? Math.round(outputSize * aw / ah) : outputSize;
    const outH = (aw && ah && ah > aw) ? Math.round(outputSize * ah / aw) : outputSize;

    if (useImageBg) {
      // --- Image background path ---
      authInfo = { imageBg: true };
      console.log(`[${jobId}] Using uploaded image background for card ${cardIdx}`);

      const { width, height } = await getImageDimensions(backgroundPath);
      console.log(`[${jobId}] Background image: ${width}x${height}`);

      const imageFit = (
        cardConfig.image_fit === 'cover' ||
        cardConfig.source_type === 'article' ||
        cardConfig.sourceType === 'article'
      ) ? 'cover' : 'contain';
      console.log(`[${jobId}] Background image fit: ${imageFit}`);

      const imageFill = (
        cardConfig.image_area === 'photo' ||
        (cardConfig.video_fill || 'full') === 'split'
      ) ? 'split' : (cardConfig.video_fill || 'full');
      console.log(`[${jobId}] Background image fill: ${imageFill}`);

      const filterChain = buildFilterChain(
        width, height, outW, outH,
        cardConfig.video_position,
        cardConfig.video_scale,
        imageFill,
        cardConfig.layout || 'photo_top',
        cardConfig.photo_ratio || 0.55,
        cardConfig.video_brightness || 0,
        imageFit,
        false
      );
      console.log(`[${jobId}] Filter chain: ${filterChain}`);

      if (ext === 'mp4') {
        // Image background → loop video
        const duration = endSec > startSec ? endSec - startSec : 5;
        console.log(`[${jobId}] Creating ${duration}s loop video from image background`);
        await execFileAsync('ffmpeg', [
          '-loop', '1',
          '-i', backgroundPath,
          '-i', overlayPath,
          '-t', String(duration),
          '-filter_complex', filterChain,
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-crf', '17',
          '-pix_fmt', 'yuv420p',
          '-an',
          '-movflags', '+faststart',
          '-y',
          outputPath,
        ], { timeout: 300000 });
      } else {
        // Image background → direct image composite
        console.log(`[${jobId}] Compositing image background with overlay`);
        await execFileAsync('ffmpeg', [
          '-i', backgroundPath,
          '-i', overlayPath,
          '-filter_complex', filterChain,
          '-vframes', '1',
          '-pix_fmt', 'yuv420p',
          '-q:v', '1',
          '-y',
          outputPath,
        ], { timeout: 60000 });
      }
    } else {
      // --- YouTube video background path (existing logic) ---
      if (endSec <= startSec) {
        throw new Error(`Invalid time range: ${cardConfig.start} - ${cardConfig.end}`);
      }

      console.log(`[${jobId}] Downloading segment ${cardIdx}: ${secondsToTime(startSec)} - ${secondsToTime(endSec)}`);
      authInfo = await downloadYouTubeSegment(url, startSec, endSec, downloadedVideo, onStatusMessage);

      if (!fs.existsSync(downloadedVideo)) {
        throw new Error('Downloaded video file not found');
      }

      const { width, height } = await getVideoDimensions(downloadedVideo);
      console.log(`[${jobId}] Video: ${width}x${height}`);

      // Low resolution detection
      if (width <= 720) {
        console.warn(`[${jobId}] Low resolution detected: ${width}x${height}`);
        try {
          const { notifyLowResolution, notifyCookieExpirySuspected } = await import('./telegram.js');
          await notifyLowResolution(jobId, width, height);
          const cookieConfigured = Boolean(process.env.YT_COOKIES_B64 || process.env.YT_COOKIES);
          if (cookieConfigured) {
            await notifyCookieExpirySuspected(jobId, cardIdx, `쿠키 사용 중 저해상도(${width}x${height}) 감지`);
          }
        } catch (e) {
          console.error('[telegram] low-res notify error:', e.message);
        }
      }

      const filterChain = buildFilterChain(
        width, height, outW, outH,
        cardConfig.video_position,
        cardConfig.video_scale,
        cardConfig.video_fill || 'full',
        cardConfig.layout || 'photo_top',
        cardConfig.photo_ratio || 0.55,
        cardConfig.video_brightness || 0
      );
      console.log(`[${jobId}] Filter chain: ${filterChain}`);

      if (ext === 'mp4') {
        console.log(`[${jobId}] Encoding video with overlay`);
        await execFileAsync('ffmpeg', [
          '-i', downloadedVideo,
          '-i', overlayPath,
          '-filter_complex', filterChain,
          '-c:v', 'libx264',
          '-preset', 'slow',
          '-crf', '17',
          '-pix_fmt', 'yuv420p',
          '-c:a', 'aac',
          '-b:a', '192k',
          '-movflags', '+faststart',
          '-y',
          outputPath,
        ], { timeout: 300000 });
      } else {
        console.log(`[${jobId}] Extracting frame for image card`);
        const captureTimeSec = parseTimeToSeconds(cardConfig.capture_time);
        const segDur = Math.max(0.01, endSec - startSec);
        // 자동 케이스는 segment 중간(또는 최대 5초)에서 추출 — segment 시작 부근의
        // fade-in/씬 전환 검정 화면과 키프레임 미스로 빈 frame 떨어지는 케이스 회피.
        // 명시적 capture_time이 있으면 그 위치 그대로.
        const seekTime = captureTimeSec > 0
          ? Math.max(0, Math.min(captureTimeSec - startSec, segDur))
          : Math.min(5, segDur * 0.5);

        // -ss를 -i 뒤(output seek)로 두어 정확 seek 사용.
        // -i 앞(input seek)은 fast seek이라 keyframe 미스 시 빈 frame 나옴.
        await execFileAsync('ffmpeg', [
          '-i', downloadedVideo,
          '-i', overlayPath,
          '-ss', String(Math.max(0, seekTime)),
          '-vframes', '1',
          '-filter_complex', filterChain,
          '-q:v', '1',
          '-y',
          outputPath,
        ], { timeout: 60000 });
      }
    }

    console.log(`[${jobId}] Card ${cardIdx} done: ${outputPath}`);

    // Bucket 업로드 (실패해도 로컬 파일 반환은 유지)
    let bucketKey = null;
    let hash = null;
    try {
      hash = Date.now().toString(36) + '_' + cardIdx;
      bucketKey = makeBucketKey(jobId, cardIdx, ext, hash);
      const contentType = ext === 'mp4' ? 'video/mp4' : 'image/jpeg';
      const uploaded = await uploadFile(bucketKey, outputPath, contentType);
      if (!uploaded) {
        console.warn(`[${jobId}] Bucket upload skipped for card ${cardIdx}`);
        bucketKey = null;
      }
    } catch (bucketErr) {
      console.error(`[${jobId}] Bucket upload error card ${cardIdx}:`, bucketErr.message);
      bucketKey = null;
    }

    return { outputPath, authInfo, bucketKey, hash };
  } catch (error) {
    const stderr = error.stderr ? error.stderr.split('\n').filter(l => l.trim()).slice(-10).join('\n') : '';
    console.error(`[${jobId}] Error card ${cardIdx}:`, error.message);
    if (stderr) console.error(`[${jobId}] ffmpeg stderr (last 10 lines):\n${stderr}`);
    const enriched = new Error(`${error.message}${stderr ? '\n' + stderr : ''}`);
    throw enriched;
  } finally {
    // Clean up downloaded video
    try {
      if (fs.existsSync(downloadedVideo)) fs.unlinkSync(downloadedVideo);
    } catch (e) {}
  }
}
