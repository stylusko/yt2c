// YouTube 영상의 native width/height 조회.
// downloadYouTubeSegment(proxy retry 포함)로 1초 세그먼트 받고 ffprobe로 dimension 읽음.
import fs from 'fs';
import path from 'path';
import { downloadYouTubeSegment, getVideoDimensions } from '../../lib/worker.js';

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

// 중복 in-flight 호출 방지 (같은 videoId 동시 요청 → 1번만 다운로드)
const _inflight = new Map();

async function fetchDims(videoId, url) {
  if (!fs.existsSync(WORK_DIR)) fs.mkdirSync(WORK_DIR, { recursive: true });
  const segPath = path.join(WORK_DIR, `${videoId}-${Date.now()}.mp4`);
  try {
    await downloadYouTubeSegment(url, 0, 1, segPath, null);
    const dims = await getVideoDimensions(segPath);
    return dims;
  } finally {
    try { if (fs.existsSync(segPath)) fs.unlinkSync(segPath); } catch {}
  }
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
    let p = _inflight.get(videoId);
    if (!p) {
      p = fetchDims(videoId, url);
      _inflight.set(videoId, p);
      p.finally(() => _inflight.delete(videoId));
    }
    const dims = await p;
    const result = { videoId, width: dims.width, height: dims.height };
    if (redis) {
      try { await redis.set(cacheKey, JSON.stringify(result), 'EX', 86400 * 7); } catch {}
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.json(result);
  } catch (err) {
    console.error('[video-info]', err.message || err);
    return res.status(500).json({ error: 'failed to fetch video info', detail: String(err.message || err).slice(0, 300) });
  }
}
