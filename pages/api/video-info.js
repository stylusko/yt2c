// YouTube 영상의 native width/height를 watch 페이지 HTML에서 추출.
// yt-dlp 대비 빠르고 의존성 없음. 실패 시 503으로 폴백 유도.

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

// HTML에 여러 스트림의 width/height가 들어있음 — 모두 같은 aspect 가짐.
// 가장 큰 dimension을 native로 간주.
function extractLargestDims(html) {
  const re = /"width":(\d+),"height":(\d+)/g;
  let best = null;
  let m;
  while ((m = re.exec(html)) !== null) {
    const w = parseInt(m[1], 10);
    const h = parseInt(m[2], 10);
    if (!w || !h || w < 100 || h < 100) continue; // 썸네일 등 제외
    if (!best || w * h > best.w * best.h) best = { w, h };
  }
  return best;
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
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const resp = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!resp.ok) throw new Error(`youtube ${resp.status}`);
    const html = await resp.text();
    const dims = extractLargestDims(html);
    if (!dims) throw new Error('dimensions not found');

    const result = { videoId, width: dims.w, height: dims.h };
    if (redis) {
      try { await redis.set(cacheKey, JSON.stringify(result), 'EX', 86400); } catch {}
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.json(result);
  } catch (err) {
    console.error('[video-info]', err.message || err);
    return res.status(500).json({ error: 'failed to fetch video info' });
  }
}
