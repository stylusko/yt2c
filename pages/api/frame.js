import { execFile, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { ensureStorageDir, getFramePath, deleteFrame, getTempPath, cleanup } from '../../lib/storage.js';

const execFileAsync = promisify(execFile);

// --- YouTube Auth (identical to lib/worker.js) ---
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
 * Download 1-second segment via yt-dlp (same params as worker.js) + extract frame.
 * Retries on 403 with delay, matching worker.js retry pattern.
 */
async function downloadAndExtract(url, ts, outputPath, jobId) {
  const startTime = secondsToTime(ts);
  const endTime = secondsToTime(ts + 1);
  const tempVideoPath = getTempPath(jobId, 'segment.mp4');

  // Identical to worker.js downloadYouTubeSegment params
  const ytArgs = [
    '--download-sections', `*${startTime}-${endTime}`,
    '-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    '--force-keyframes-at-cuts',
    '--merge-output-format', 'mp4',
    '--js-runtimes', 'node',
    '-o', tempVideoPath,
    '--no-playlist',
    ...buildYtDlpAuthArgs(),
    url,
  ];

  // Retry on 403 with delay (shorter than worker.js since this is interactive)
  const retryDelays = [5000, 15000]; // 5s, 15s
  let lastErr;

  for (let attempt = 1; attempt <= retryDelays.length + 1; attempt++) {
    try {
      console.log(`[frame] yt-dlp attempt ${attempt}: ${startTime}-${endTime}`);
      await execFileAsync('yt-dlp', ytArgs, { timeout: 90000, maxBuffer: 50 * 1024 * 1024 });

      // Find downloaded file
      const tempDir = path.dirname(tempVideoPath);
      const files = fs.readdirSync(tempDir).filter(f => f.startsWith('segment'));
      const actualFile = files.length > 0 ? path.join(tempDir, files[0]) : tempVideoPath;

      if (!fs.existsSync(actualFile)) throw new Error('No output file after yt-dlp');

      // Extract first frame
      console.log('[frame] ffmpeg extracting frame from:', actualFile);
      await execFileAsync('ffmpeg', [
        '-i', actualFile, '-frames:v', '1', '-vf', 'scale=-1:720', '-y', outputPath,
      ], { timeout: 15000 });

      return; // success
    } catch (err) {
      lastErr = err;
      // Clean partial download before retry
      try { const td = path.dirname(tempVideoPath); if (fs.existsSync(td)) fs.rmSync(td, { recursive: true, force: true }); } catch (_) {}
      // Recreate temp dir for next attempt
      getTempPath(jobId, '_');

      const stderr = err.stderr || '';
      const is403 = stderr.includes('403') || stderr.includes('Forbidden');
      if (is403 && attempt <= retryDelays.length) {
        const delay = retryDelays[attempt - 1];
        console.warn(`[frame] 403 on attempt ${attempt}, retrying in ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
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
    await downloadAndExtract(url, ts, outputPath, jobId);
  } catch (err) {
    cleanup(jobId);
    const stderr = err.stderr || '';
    console.error('[frame] failed:', err.message, stderr.slice(0, 500));
    if (stderr.includes('403') || stderr.includes('Forbidden')) {
      return res.status(502).json({ error: 'YouTube access denied (403). Try again later.' });
    }
    return res.status(500).json({ error: (stderr.slice(0, 200) || err.message) });
  }

  cleanup(jobId);

  if (!fs.existsSync(outputPath)) {
    return res.status(500).json({ error: 'Frame extraction failed' });
  }

  return res.status(200).json({ frame: frameId });
}
