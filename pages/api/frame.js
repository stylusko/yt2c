import { execFile } from 'child_process';
import fs from 'fs';
import { promisify } from 'util';
import Redis from 'ioredis';
import { ensureCookieFile } from '../../lib/worker.js';

const execFileAsync = promisify(execFile);

const COOKIE_PATH = '/tmp/yt-cookies.txt';
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let _redis = null;
function getRedis() {
  if (!_redis) _redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  return _redis;
}

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
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
    const redis = getRedis();
    const cacheKey = `ytframe:${videoId}`;
    let streamUrl = await redis.get(cacheKey);

    if (!streamUrl) {
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
      streamUrl = stdout.trim().split('\n')[0];
      if (!streamUrl) throw new Error('yt-dlp returned empty stream URL');

      await redis.set(cacheKey, streamUrl, 'EX', 4 * 3600);
    }

    const ffmpegArgs = [
      '-ss', String(seconds),
      '-i', streamUrl,
      '-frames:v', '1',
      '-vf', 'scale=320:-1',
      '-q:v', '5',
      '-f', 'image2',
      'pipe:1',
    ];

    const { stdout: frameBuffer } = await execFileAsync('ffmpeg', ffmpegArgs, {
      timeout: 15000,
      encoding: 'buffer',
      maxBuffer: 5 * 1024 * 1024,
    });

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(frameBuffer);
  } catch (err) {
    console.error('[frame]', err.message);
    // 캐시된 스트림 URL이 만료되었을 수 있으므로 삭제
    try { await getRedis().del(`ytframe:${videoId}`); } catch (_) {}
    res.status(500).json({ error: 'frame extraction failed' });
  }
}
