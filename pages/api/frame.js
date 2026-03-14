import { execFile, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { ensureStorageDir, getFramePath, deleteFrame, getTempPath, cleanup } from '../../lib/storage.js';

const execFileAsync = promisify(execFile);

// --- YouTube Auth (reused from lib/worker.js) ---
const COOKIE_PATH = '/tmp/yt-cookies.txt';
let cookieReady = false;
function ensureCookieFile() {
  if (cookieReady) return;
  cookieReady = true;
  const b64 = process.env.YT_COOKIES_B64;
  const plain = process.env.YT_COOKIES;
  if (b64) {
    fs.writeFileSync(COOKIE_PATH, Buffer.from(b64, 'base64').toString('utf-8'));
  } else if (plain) {
    fs.writeFileSync(COOKIE_PATH, plain, 'utf-8');
  }
}

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
  } catch (e) {
    console.error('[frame] OAuth2 cache extract failed:', e.message);
  }
}

const YOUTUBE_HOST_RE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i;

// --- Stream URL cache (YouTube URLs valid ~6h, cache for 1h) ---
const streamCache = new Map();
const CACHE_TTL = 3600000;

function getCachedStream(videoUrl) {
  const entry = streamCache.get(videoUrl);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry;
  streamCache.delete(videoUrl);
  return null;
}

function setCachedStream(videoUrl, streamUrl, headers) {
  streamCache.set(videoUrl, { streamUrl, headers, ts: Date.now() });
  // Evict old entries
  if (streamCache.size > 50) {
    for (const [k, v] of streamCache) {
      if (Date.now() - v.ts > CACHE_TTL) streamCache.delete(k);
    }
  }
}

function secondsToTime(seconds) {
  const s = Math.floor(seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return [hours, minutes, secs].map(v => String(v).padStart(2, '0')).join(':');
}

function buildYtDlpAuthArgs() {
  const args = [];
  ensureCookieFile();
  ensureOAuthCache();
  if (process.env.YT_OAUTH_CACHE_B64) {
    args.push('--username', 'oauth2', '--password', '', '--cache-dir', OAUTH_CACHE_DIR);
  } else if (fs.existsSync(COOKIE_PATH)) {
    args.push('--cookies', COOKIE_PATH);
  }
  if (process.env.YT_PO_TOKEN) {
    args.push('--extractor-args', `youtube:po_token=web+${process.env.YT_PO_TOKEN}`);
  }
  if (process.env.YT_PROXY) {
    args.push('--proxy', process.env.YT_PROXY);
  }
  return args;
}

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
  const { id } = req.query;
  if (!id || !/^[a-f0-9-]+\.png$/.test(id)) {
    return res.status(400).json({ error: 'Invalid frame id' });
  }
  const fp = getFramePath(id);
  if (!fs.existsSync(fp)) {
    return res.status(404).json({ error: 'Frame not found' });
  }
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  fs.createReadStream(fp).pipe(res);
}

/**
 * Fast path: yt-dlp -j → extract stream URL + headers → ffmpeg direct network seek
 * No file download needed — ffmpeg grabs 1 frame directly from the stream.
 */
async function captureFrameFast(url, ts, outputPath) {
  let streamUrl, headers;

  // Check cache first
  const cached = getCachedStream(url);
  if (cached) {
    console.log('[frame:fast] cache hit');
    streamUrl = cached.streamUrl;
    headers = cached.headers;
  } else {
    // Resolve via yt-dlp
    const ytArgs = [
      '-f', 'bestvideo[height<=720][ext=mp4]/bestvideo[height<=720][ext=webm]/bestvideo[height<=720]',
      '-j',
      '--no-playlist',
      '--no-warnings',
      '--js-runtimes', 'node',
      ...buildYtDlpAuthArgs(),
      url,
    ];

    console.log('[frame:fast] yt-dlp -j start');
    const { stdout } = await execFileAsync('yt-dlp', ytArgs, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
    const info = JSON.parse(stdout);
    console.log('[frame:fast] yt-dlp -j done');

    const fmt = info.requested_formats?.[0] || info;
    streamUrl = fmt.url;
    headers = fmt.http_headers || {};
    if (!streamUrl) throw new Error('No stream URL in yt-dlp output');

    setCachedStream(url, streamUrl, headers);
  }

  // 2. Build ffmpeg args with headers from yt-dlp
  const ffArgs = ['-ss', String(ts)];
  if (headers['User-Agent']) ffArgs.push('-user_agent', headers['User-Agent']);
  if (headers['Referer']) ffArgs.push('-referer', headers['Referer']);
  const extra = Object.entries(headers)
    .filter(([k]) => !['User-Agent', 'Referer', 'Accept', 'Accept-Language', 'Sec-Fetch-Mode'].includes(k));
  if (extra.length > 0) {
    ffArgs.push('-headers', extra.map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n');
  }
  ffArgs.push('-i', streamUrl, '-frames:v', '1', '-vf', 'scale=-1:720', '-y', outputPath);

  console.log('[frame:fast] ffmpeg start');
  await execFileAsync('ffmpeg', ffArgs, { timeout: 15000 });
  console.log('[frame:fast] ffmpeg done');
}

/**
 * Slow fallback: yt-dlp downloads 1-second segment → ffmpeg extracts frame from local file.
 */
async function captureFrameSlow(url, ts, outputPath, jobId) {
  const startTime = secondsToTime(ts);
  const endTime = secondsToTime(ts + 1);
  const tempVideoPath = getTempPath(jobId, 'segment.%(ext)s');

  const ytArgs = [
    '--download-sections', `*${startTime}-${endTime}`,
    '-f', 'bestvideo[height<=720][ext=mp4]/bestvideo[height<=720]',
    '--js-runtimes', 'node',
    '-o', tempVideoPath,
    '--no-playlist',
    ...buildYtDlpAuthArgs(),
    url,
  ];

  console.log('[frame:slow] yt-dlp download start');
  await execFileAsync('yt-dlp', ytArgs, { timeout: 60000, maxBuffer: 50 * 1024 * 1024 });
  console.log('[frame:slow] yt-dlp download done');

  const tempDir = path.dirname(tempVideoPath);
  const files = fs.readdirSync(tempDir).filter(f => f.startsWith('segment'));
  const actualFile = files.length > 0 ? path.join(tempDir, files[0]) : tempVideoPath;

  if (!fs.existsSync(actualFile)) throw new Error('Video segment download failed');

  await execFileAsync('ffmpeg', [
    '-i', actualFile, '-frames:v', '1', '-vf', 'scale=-1:720', '-y', outputPath,
  ], { timeout: 15000 });
}

async function handlePost(req, res) {
  const { url, timestamp, oldFrame } = req.body;

  if (!url || !YOUTUBE_HOST_RE.test(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }
  if (timestamp == null || isNaN(Number(timestamp)) || Number(timestamp) < 0) {
    return res.status(400).json({ error: 'Invalid timestamp' });
  }

  const ts = Number(timestamp);
  const jobId = uuidv4();

  if (oldFrame && /^[a-f0-9-]+\.png$/.test(oldFrame)) {
    try { deleteFrame(oldFrame); } catch (_) {}
  }

  ensureStorageDir();

  const frameId = uuidv4() + '.png';
  const outputPath = getFramePath(frameId);

  try {
    // Fast path: direct network seek (no file download)
    await captureFrameFast(url, ts, outputPath);
  } catch (fastErr) {
    console.warn('[frame] fast path failed:', fastErr.message);
    // Invalidate cache and retry with fresh URL
    streamCache.delete(url);
    try {
      await captureFrameFast(url, ts, outputPath);
    } catch (retryErr) {
      console.warn('[frame] fast retry failed, trying slow fallback:', retryErr.message);
      try {
        await captureFrameSlow(url, ts, outputPath, jobId);
      } catch (slowErr) {
        cleanup(jobId);
        const allStderr = [fastErr.stderr, retryErr.stderr, slowErr.stderr].filter(Boolean).join('\n');
        console.error('[frame] all paths failed. fast:', fastErr.message, '| retry:', retryErr.message, '| slow:', slowErr.message, '| stderr:', allStderr.slice(0, 1000));
        if (allStderr.includes('403') || allStderr.includes('Forbidden')) {
          return res.status(502).json({ error: 'YouTube access denied (403). Try again later.' });
        }
        // Include stderr snippet for debugging
        const detail = (slowErr.stderr || retryErr.stderr || fastErr.stderr || '').slice(0, 300);
        return res.status(500).json({ error: 'Frame capture failed: ' + (detail || slowErr.message) });
      }
    }
  }

  cleanup(jobId);

  if (!fs.existsSync(outputPath)) {
    return res.status(500).json({ error: 'Frame extraction failed' });
  }

  return res.status(200).json({ frame: frameId });
}
