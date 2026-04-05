import { execFile } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';
import { ensureCookieFile } from '../../lib/worker.js';

const execFileAsync = promisify(execFile);
const COOKIE_PATH = '/tmp/yt-cookies.txt';

// Redis: optional cache, graceful fallback
let _redis = null;
async function getRedis() {
  if (_redis === false) return null;
  if (_redis) return _redis;
  try {
    const Redis = (await import('ioredis')).default;
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    _redis = new Redis(redisUrl, { maxRetriesPerRequest: 1, retryStrategy: () => null });
    await _redis.ping();
    return _redis;
  } catch {
    _redis = false;
    return null;
  }
}

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'invalid YouTube URL' });

  const redis = await getRedis();
  const cacheKey = `ytinfo:${videoId}`;
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.json(JSON.parse(cached));
      }
    } catch {}
  }

  try {
    ensureCookieFile();
    const args = [
      '--skip-download',
      '--dump-single-json',
      '--no-playlist',
      '--js-runtimes', 'node',
      '--remote-components', 'ejs:github',
    ];
    if (fs.existsSync(COOKIE_PATH)) args.push('--cookies', COOKIE_PATH);
    args.push(url);

    const { stdout } = await execFileAsync('yt-dlp', args, {
      timeout: 20000,
      maxBuffer: 20 * 1024 * 1024,
    });
    const meta = JSON.parse(stdout);
    const width = meta.width || null;
    const height = meta.height || null;
    const result = { videoId, width, height, title: meta.title || null };

    if (redis && width && height) {
      try { await redis.set(cacheKey, JSON.stringify(result), 'EX', 86400); } catch {}
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.json(result);
  } catch (err) {
    console.error('[video-info]', err.message || err);
    return res.status(500).json({ error: 'failed to fetch video info' });
  }
}
