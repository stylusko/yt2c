import { getVideoInfo, extractSubtitles } from '../../lib/subtitle.js';

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'url 파라미터가 필요합니다.' });
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return res.status(400).json({ error: 'videoId를 추출할 수 없습니다. 올바른 YouTube URL인지 확인하세요.' });
  }

  const cacheKey = `ytsub:${videoId}`;
  const CACHE_TTL = 24 * 60 * 60; // 24시간(초)

  // Redis 캐시 확인
  const redis = await getRedis();
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.status(200).json(JSON.parse(cached));
      }
    } catch (e) {
      console.warn('[api/subtitle] Redis 캐시 읽기 실패:', e.message);
    }
  }

  // 영상 정보 조회
  let info;
  try {
    info = await getVideoInfo(url);
  } catch (e) {
    console.error('[api/subtitle] getVideoInfo 실패:', e.message);
    return res.status(500).json({ error: '영상 정보를 가져올 수 없습니다.' });
  }

  // 자막 추출
  let subtitleResult;
  try {
    subtitleResult = await extractSubtitles(url, videoId);
  } catch (e) {
    console.error('[api/subtitle] extractSubtitles 실패:', e.message);
    return res.status(500).json({ error: '자막을 추출할 수 없습니다.' });
  }

  const result = {
    videoId,
    title: info.title,
    duration: info.duration,
    transcript: subtitleResult.transcript,
  };

  // Redis 캐시 저장
  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL);
    } catch (e) {
      console.warn('[api/subtitle] Redis 캐시 저장 실패:', e.message);
    }
  }

  return res.status(200).json(result);
}
