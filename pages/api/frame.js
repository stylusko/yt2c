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

  // Delete old frame if provided
  if (oldFrame && /^[a-f0-9-]+\.png$/.test(oldFrame)) {
    try { deleteFrame(oldFrame); } catch (_) {}
  }

  ensureStorageDir();

  try {
    // 1. Download a 1-second segment via yt-dlp (handles all auth internally)
    const startTime = secondsToTime(ts);
    const endTime = secondsToTime(ts + 1);
    const tempVideoPath = getTempPath(jobId, 'segment.mp4');

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

    await execFileAsync('yt-dlp', ytArgs, { timeout: 60000 });

    if (!fs.existsSync(tempVideoPath)) {
      cleanup(jobId);
      return res.status(500).json({ error: 'Video segment download failed' });
    }

    // 2. Extract first frame from downloaded segment
    const frameId = uuidv4() + '.png';
    const outputPath = getFramePath(frameId);

    await execFileAsync('ffmpeg', [
      '-i', tempVideoPath,
      '-frames:v', '1',
      '-vf', 'scale=-1:720',
      '-y',
      outputPath,
    ], { timeout: 15000 });

    // 3. Cleanup temp files
    cleanup(jobId);

    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({ error: 'Frame extraction failed' });
    }

    return res.status(200).json({ frame: frameId });
  } catch (err) {
    cleanup(jobId);
    console.error('[frame] Capture error:', err.message, err.stderr?.slice(0, 500));
    const stderr = err.stderr || '';
    if (stderr.includes('403') || stderr.includes('Forbidden')) {
      return res.status(502).json({ error: 'YouTube access denied (403). Try again later.' });
    }
    return res.status(500).json({ error: 'Frame capture failed: ' + err.message });
  }
}
