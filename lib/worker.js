import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { getTempPath, getOutputPath, cleanup } from './storage.js';

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
 * Convert seconds to HH:MM:SS format
 */
function secondsToTime(seconds) {
  const s = Math.floor(seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return [hours, minutes, secs].map(v => String(v).padStart(2, '0')).join(':');
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
 * @param {number} photoRatio - ratio of photo area (0-1)
 */
function buildFilterChain(vw, vh, outW, outH, videoPos, videoScale, videoFill, layout, photoRatio, videoBrightness) {
  const [rawX, rawY] = videoPos || [0, 0];
  const zoom = Math.max((videoScale ?? 100), 1) / 100; // min 1% to avoid zero
  const aspect = vw / vh;
  const bright = (videoBrightness || 0) / 100; // -0.5 to +0.5
  const eqFilter = bright !== 0 ? `,eq=brightness=${bright.toFixed(2)}` : '';
  // Clamp photoRatio to valid range
  photoRatio = Math.max(0.1, Math.min(0.95, photoRatio || 0.55));
  // Ensure even dimensions for yuv420p compatibility
  const even = (n) => Math.round(n / 2) * 2;

  // 프론트엔드 오프셋 공식과 동일하게 픽셀 위치 계산 (음수/화면 밖 위치 지원)
  // Frontend: offX = scaledW * videoX / 400 + (scaledW - targetW) / 2
  // → videoLeft = -offX = (targetW - scaleW) / 2 - scaleW * videoX / 400
  function computePixelPos(rawVal, scaleD, targetD) {
    return Math.round((targetD - scaleD) / 2 - scaleD * (rawVal ?? 0) / 400);
  }

  // overlay 방식: 음수 좌표 지원으로 프론트엔드와 정확히 일치
  function buildVideoFilter(scaleW, scaleH, targetW, targetH) {
    const posX = computePixelPos(rawX, scaleW, targetW);
    const posY = computePixelPos(rawY, scaleH, targetH);
    return `[0:v]scale=${scaleW}:${scaleH}${eqFilter}[sv];color=black:${targetW}x${targetH},format=yuv420p[bg];[bg][sv]overlay=${posX}:${posY}:shortest=1`;
  }

  if (videoFill === 'split' && layout !== 'text_overlay' && layout !== 'none') {
    // 분리형: 영상은 영상 영역에만 배치
    const textH = Math.round(outH * (1 - (photoRatio || 0.55)));
    const videoH = outH - textH;
    const videoY = layout === 'photo_top' ? 0 : textH;

    // Scale video to fill the video area
    const videoAspect = outW / videoH;
    let scaleW, scaleH;
    if (aspect >= videoAspect) {
      scaleH = even(Math.round(videoH * zoom));
      scaleW = even(Math.round(scaleH * aspect));
    } else {
      scaleW = even(Math.round(outW * zoom));
      scaleH = even(Math.round(scaleW / aspect));
    }

    const vf = buildVideoFilter(scaleW, scaleH, outW, videoH);
    return `${vf},pad=${outW}:${outH}:0:${videoY}:black[scaled];[1:v]format=yuva420p[ov];[scaled][ov]overlay=0:0`;
  }

  // 전체 채우기: 영상이 전체 카드에 깔림
  let scaleW, scaleH;
  const outAspect = outW / outH;
  if (aspect >= outAspect) {
    scaleH = even(Math.round(outH * zoom));
    scaleW = even(Math.round(scaleH * aspect));
  } else {
    scaleW = even(Math.round(outW * zoom));
    scaleH = even(Math.round(scaleW / aspect));
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
async function downloadYouTubeSegment(url, startSec, endSec, outputPath) {
  const startTime = secondsToTime(startSec);
  const endTime = secondsToTime(endSec);

  console.log(`  yt-dlp: downloading ${startTime} - ${endTime}`);

  ensureCookieFile();
  if (proxyList.length === 0) loadProxies();

  const baseArgs = [
    '--download-sections', `*${startTime}-${endTime}`,
    '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
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
    const isGeoBlock = stderr.includes('not made this video available in your country') || stderr.includes('geo') || stderr.includes('country');

    if ((isBot || is403 || isNetwork || isCorrupt || isGeoBlock) && proxyList.length > 0) {
      const reason = isBot ? 'bot감지' : is403 ? '403' : isGeoBlock ? '지역제한' : isCorrupt ? '파일손상' : 'network';
      authInfo.directFailReason = reason;
      console.warn(`  yt-dlp: 1차 실패 (${reason}), 프록시로 전환...`);
      try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}
    } else if (isGeoBlock) {
      throw Object.assign(new Error('이 영상은 지역 제한으로 다운로드할 수 없습니다. 한국 프록시가 설정되어 있지 않습니다.'), { stderr: err.stderr });
    } else {
      throw err; // 프록시 없거나 다른 종류 에러 → 즉시 실패
    }
  }

  // 2단계: 프록시 로테이션
  const maxProxyAttempts = Math.min(proxyList.length, 5);
  const retryDelayMs = 5000;
  let lastErr;

  for (let attempt = 1; attempt <= maxProxyAttempts; attempt++) {
    const args = [...baseArgs];
    const urlIdx = args.indexOf(url);
    const proxy = getNextProxy();
    if (proxy) {
      args.splice(urlIdx, 0, '--proxy', proxy);
      console.log(`  yt-dlp: 프록시 ${attempt}/${maxProxyAttempts}: ${proxy.replace(/\/\/.*@/, '//***@')}`);
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
      const isGeoBlock = stderr.includes('not made this video available in your country') || stderr.includes('geo') || stderr.includes('country');

      if ((isBot || is403 || isNetwork || isProxyErr || isCorrupt || isGeoBlock) && attempt < maxProxyAttempts) {
        const reason = isBot ? 'bot감지' : is403 ? '403' : isGeoBlock ? '지역제한' : isCorrupt ? '파일손상' : isProxyErr ? '프록시오류' : 'network';
        console.warn(`  yt-dlp: 프록시 ${attempt} 실패 (${reason}), 다음 프록시...`);
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

export { ensureCookieFile };

export async function processCard({
  jobId,
  cardConfig,
  url,
  cardIdx,
  overlayPath,
  backgroundPath,
  outputFormat = 'mp4',
  outputSize = 1080,
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
    const outW = outputSize;
    const outH = ar === '3:4' ? Math.round(outputSize * 4 / 3) : outputSize;

    if (useImageBg) {
      // --- Image background path ---
      authInfo = { imageBg: true };
      console.log(`[${jobId}] Using uploaded image background for card ${cardIdx}`);

      const { width, height } = await getImageDimensions(backgroundPath);
      console.log(`[${jobId}] Background image: ${width}x${height}`);

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
      authInfo = await downloadYouTubeSegment(url, startSec, endSec, downloadedVideo);

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
        const seekTime = captureTimeSec > 0
          ? Math.min(captureTimeSec - startSec, endSec - startSec)
          : Math.min(1, (endSec - startSec) * 0.25);

        await execFileAsync('ffmpeg', [
          '-ss', String(Math.max(0, seekTime)),
          '-i', downloadedVideo,
          '-i', overlayPath,
          '-vframes', '1',
          '-filter_complex', filterChain,
          '-q:v', '1',
          '-y',
          outputPath,
        ], { timeout: 60000 });
      }
    }

    console.log(`[${jobId}] Card ${cardIdx} done: ${outputPath}`);
    return { outputPath, authInfo };
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
