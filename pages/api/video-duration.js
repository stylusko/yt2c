// YouTube 영상의 duration(초)만 빠르게 반환
import { getVideoInfo } from '../../lib/subtitle.js';

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
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
  } catch {}
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url 파라미터가 필요합니다.' });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: '올바른 YouTube URL이 아닙니다.' });

  const cacheKey = `ytdur:${videoId}`;
  const redis = await getRedis();
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
    const info = await getVideoInfo(url);
    const result = { videoId, duration: info.duration || 0, title: info.title || '' };
    if (redis) {
      try { await redis.set(cacheKey, JSON.stringify(result), 'EX', 86400 * 7); } catch {}
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.json(result);
  } catch (err) {
    console.error('[video-duration]', err.message || err);
    return res.status(500).json({ error: '영상 정보를 가져올 수 없습니다.', detail: String(err.message || err).slice(0, 300) });
  }
}
