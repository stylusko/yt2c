import { execFile } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';
import { ensureCookieFile } from '../../lib/worker.js';

const execFileAsync = promisify(execFile);

const COOKIE_PATH = '/tmp/yt-cookies.txt';

// Redis: optional cache, graceful fallback
let _redis = null;
async function getRedis() {
  if (_redis === false) return null; // permanently failed
  if (_redis) return _redis;
  try {
    const Redis = (await import('ioredis')).default;
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    _redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, retryStrategy: () => null });
    await _redis.ping();
    return _redis;
  } catch {
    console.warn('[frame] Redis unavailable, running without cache');
    _redis = false;
    return null;
  }
}

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function getStreamUrl(url, videoId) {
  const redis = await getRedis();
  const cacheKey = `ytframe:${videoId}`;

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return cached;
    } catch {}
  }

  ensureCookieFile();

  const args = [
    '-g',
    '-f', 'worst[height>=360]/worst',
    '--js-runtimes', 'node',
    '--remote-components', 'ejs:github',
    '--no-playlist',
  ];
  if (fs.existsSync(COOKIE_PATH)) {
    args.push('--cookies', COOKIE_PATH);
  }
  args.push(url);

  const { stdout } = await execFileAsync('yt-dlp', args, { timeout: 30000 });
  const streamUrl = stdout.trim().split('\n')[0];
  if (!streamUrl) throw new Error('yt-dlp returned empty stream URL');

  if (redis) {
    try { await redis.set(cacheKey, streamUrl, 'EX', 4 * 3600); } catch {}
  }

  return streamUrl;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { url, t } = req.query;
  if (!url || t == null) return res.status(400).json({ error: 'url and t are required' });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'invalid YouTube URL' });

  const seconds = parseFloat(t);
  if (isNaN(seconds) || seconds < 0) return res.status(400).json({ error: 'invalid time' });

  // 1단계: yt-dlp로 스트림 URL 획득 + ffmpeg 프레임 추출 시도
  let streamUrl;
  try {
    streamUrl = await getStreamUrl(url, videoId);
    console.log('[frame] stream URL obtained, extracting frame at', seconds, 's');
  } catch (err) {
    const stderr = err.stderr || '';
    console.error('[frame] yt-dlp failed:', err.message, stderr.slice(0, 500));
    return res.status(500).json({ error: 'yt-dlp failed', detail: err.message, stderr: stderr.slice(0, 1000) });
  }

  try {
    const buffer = 10;
    const inputSeek = Math.max(0, seconds - buffer);
    const outputSeek = seconds - inputSeek;
    const ffmpegArgs = [
      '-ss', String(inputSeek),
      '-i', streamUrl,
      ...(outputSeek > 0 ? ['-ss', String(outputSeek)] : []),
      '-frames:v', '1',
      '-vf', 'scale=320:-1',
      '-q:v', '5',
      '-f', 'image2',
      'pipe:1',
    ];

    const { stdout: frameBuffer } = await execFileAsync('ffmpeg', ffmpegArgs, {
      timeout: 30000,
      encoding: 'buffer',
      maxBuffer: 5 * 1024 * 1024,
    });

    if (!frameBuffer || frameBuffer.length === 0) throw new Error('empty frame buffer');

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(frameBuffer);
  } catch (err) {
    const stderr = err.stderr || '';
    console.error('[frame] ffmpeg failed:', err.message, stderr.slice(0, 500));
    try {
      const redis = await getRedis();
      if (redis) await redis.del(`ytframe:${videoId}`);
    } catch {}
    res.status(500).json({ error: 'ffmpeg failed', detail: err.message, stderr: stderr.slice(0, 1000) });
  }
}
