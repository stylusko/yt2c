import { execFile, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { getTempPath, getOutputPath, cleanup } from './storage.js';

const execFileAsync = promisify(execFile);

// --- YouTube Auth ---
// Priority: OAuth2 > PO Token > Cookies

// 1. Cookies (legacy)
const COOKIE_PATH = '/tmp/yt-cookies.txt';
let cookieReady = false;
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

// 2. OAuth2 (long-lived refresh token)
const OAUTH_CACHE_DIR = '/tmp/yt-dlp-cache';
let oauthReady = false;
function ensureOAuthCache() {
  if (oauthReady) return;
  oauthReady = true;
  const b64 = process.env.YT_OAUTH_CACHE_B64;
  if (!b64) return;
  try {
    fs.mkdirSync(OAUTH_CACHE_DIR, { recursive: true });
    const tarPath = '/tmp/yt-oauth-cache.tar';
    fs.writeFileSync(tarPath, Buffer.from(b64, 'base64'));
    execFileSync('tar', ['xf', tarPath, '-C', OAUTH_CACHE_DIR]);
    fs.unlinkSync(tarPath);
    console.log('[auth] OAuth2 cache extracted');
  } catch (e) {
    console.error('[auth] OAuth2 cache extract failed:', e.message);
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
  const [vx, vy] = videoPos || [50, 50];
  const zoom = Math.max((videoScale ?? 100), 1) / 100; // min 1% to avoid zero
  const aspect = vw / vh;
  const bright = (videoBrightness || 0) / 100; // -0.5 to +0.5
  const eqFilter = bright !== 0 ? `,eq=brightness=${bright.toFixed(2)}` : '';
  // Clamp photoRatio to valid range
  photoRatio = Math.max(0.1, Math.min(0.95, photoRatio || 0.55));
  // Ensure even dimensions for yuv420p compatibility
  const even = (n) => Math.round(n / 2) * 2;

  // Unified scale → pad → crop pipeline (handles zoom < 1 and zoom >= 1)
  function buildScalePadCrop(scaleW, scaleH, targetW, targetH, posX, posY) {
    // Pad: ensure at least target dimensions
    const afterPadW = even(Math.max(scaleW, targetW));
    const afterPadH = even(Math.max(scaleH, targetH));
    const padX = scaleW < afterPadW ? Math.round((afterPadW - scaleW) * posX / 100) : 0;
    const padY = scaleH < afterPadH ? Math.round((afterPadH - scaleH) * posY / 100) : 0;
    // Crop: trim to exact target dimensions
    const cropOffX = afterPadW > targetW ? Math.round((afterPadW - targetW) * posX / 100) : 0;
    const cropOffY = afterPadH > targetH ? Math.round((afterPadH - targetH) * posY / 100) : 0;

    const needPad = scaleW < afterPadW || scaleH < afterPadH;
    const needCrop = afterPadW > targetW || afterPadH > targetH;
    let filters = `scale=${scaleW}:${scaleH}`;
    if (needPad) filters += `,pad=${afterPadW}:${afterPadH}:${padX}:${padY}:black`;
    if (needCrop) filters += `,crop=${targetW}:${targetH}:${cropOffX}:${cropOffY}`;
    return filters;
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

    const spc = buildScalePadCrop(scaleW, scaleH, outW, videoH, vx, vy);
    return `[0:v]${spc}${eqFilter},pad=${outW}:${outH}:0:${videoY}:black,format=yuv420p[scaled];[1:v]format=yuva420p[ov];[scaled][ov]overlay=0:0`;
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

  const spc = buildScalePadCrop(scaleW, scaleH, outW, outH, vx, vy);
  return `[0:v]${spc}${eqFilter},format=yuv420p[scaled];[1:v]format=yuva420p[ov];[scaled][ov]overlay=0:0`;
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
  ensureOAuthCache();

  const args = [
    '--download-sections', `*${startTime}-${endTime}`,
    '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    '--force-keyframes-at-cuts',
    '--merge-output-format', 'mp4',
    '--js-runtimes', 'node',
    '-o', outputPath,
    '--no-playlist',
  ];

  // OAuth2 (highest priority — long-lived refresh token)
  if (process.env.YT_OAUTH_CACHE_B64) {
    args.push('--username', 'oauth2', '--password', '', '--cache-dir', OAUTH_CACHE_DIR);
  }
  // Cookies (fallback)
  else if (fs.existsSync(COOKIE_PATH)) {
    args.push('--cookies', COOKIE_PATH);
  }

  // PO Token (can stack with OAuth2 or cookies)
  if (process.env.YT_PO_TOKEN) {
    args.push('--extractor-args', `youtube:po_token=web+${process.env.YT_PO_TOKEN}`);
  }

  // Proxy (bypass bot detection / IP blocks)
  if (process.env.YT_PROXY) {
    args.push('--proxy', process.env.YT_PROXY);
  }

  args.push(url);

  // Retry with longer backoff on 403/network errors (temporary YouTube throttling/block)
  const retryDelaysMs = [30000, 120000, 300000]; // 30s -> 2m -> 5m
  let lastErr;
  for (let attempt = 1; attempt <= retryDelaysMs.length + 1; attempt++) {
    try {
      await execFileAsync('yt-dlp', args, { timeout: 180000 }); // 3 minute timeout
      return; // success
    } catch (err) {
      lastErr = err;
      const stderr = err.stderr || '';
      const is403 = stderr.includes('403') || stderr.includes('Forbidden');
      const isNetwork = stderr.includes('HTTP error') || stderr.includes('urlopen error') || stderr.includes('timed out');
      if ((is403 || isNetwork) && attempt <= retryDelaysMs.length) {
        const delayMs = retryDelaysMs[attempt - 1];
        console.warn(`  yt-dlp: attempt ${attempt} failed (${is403 ? '403' : 'network'}), retrying in ${Math.round(delayMs / 1000)}s...`);
        // Remove partial download before retry
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}
        await new Promise(r => setTimeout(r, delayMs));
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
    // Compute output dimensions based on aspect ratio
    const ar = cardConfig.aspect_ratio || '1:1';
    const outW = outputSize;
    const outH = ar === '3:4' ? Math.round(outputSize * 4 / 3) : outputSize;

    if (useImageBg) {
      // --- Image background path ---
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
      await downloadYouTubeSegment(url, startSec, endSec, downloadedVideo);

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
    return outputPath;
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
