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

  try {
    const streamUrl = await getStreamUrl(url, videoId);

    // Input seeking으로 10초 전까지 빠르게 점프 후, output seeking으로 나머지 프레임 단위 정밀 탐색
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

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(frameBuffer);
  } catch (err) {
    console.error('[frame]', err.message);
    // 캐시된 스트림 URL이 만료되었을 수 있으므로 삭제
    try {
      const redis = await getRedis();
      if (redis) await redis.del(`ytframe:${videoId}`);
    } catch {}
    res.status(500).json({ error: 'frame extraction failed' });
  }
}
