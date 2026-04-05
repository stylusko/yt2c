// YouTube 영상의 native width/height를 yt-dlp로 짧은 세그먼트만 받아 ffprobe로 읽음.
// frame.js와 동일한 yt-dlp 플래그 사용 (Railway 검증됨).
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { ensureCookieFile } from '../../lib/worker.js';

const execFileAsync = promisify(execFile);
const COOKIE_PATH = '/tmp/yt-cookies.txt';
const WORK_DIR = '/tmp/yt2c-storage/videoinfo';

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

  if (!fs.existsSync(WORK_DIR)) fs.mkdirSync(WORK_DIR, { recursive: true });
  const segPath = path.join(WORK_DIR, `${videoId}-${Date.now()}.mp4`);

  try {
    ensureCookieFile();
    const ytdlpArgs = [
      '--download-sections', '*00:00:00-00:00:01',
      '-f', 'worst[height>=360]/worst',
      '--force-keyframes-at-cuts',
      '--merge-output-format', 'mp4',
      '--js-runtimes', 'node',
      '--remote-components', 'ejs:github',
      '-o', segPath,
      '--no-playlist',
    ];
    if (fs.existsSync(COOKIE_PATH)) ytdlpArgs.push('--cookies', COOKIE_PATH);
    ytdlpArgs.push(url);

    await execFileAsync('yt-dlp', ytdlpArgs, { timeout: 60000 });

    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=s=x:p=0',
      segPath,
    ], { timeout: 15000 });

    const [w, h] = stdout.trim().split('x').map(Number);
    if (!w || !h) throw new Error('invalid dimensions');

    const result = { videoId, width: w, height: h };
    if (redis) {
      try { await redis.set(cacheKey, JSON.stringify(result), 'EX', 86400); } catch {}
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.json(result);
  } catch (err) {
    console.error('[video-info]', err.message || err);
    return res.status(500).json({ error: 'failed to fetch video info', detail: String(err.message || err).slice(0, 200) });
  } finally {
    try { if (fs.existsSync(segPath)) fs.unlinkSync(segPath); } catch {}
  }
}
