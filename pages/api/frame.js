import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { ensureCookieFile, downloadYouTubeSegment } from '../../lib/worker.js';

const execFileAsync = promisify(execFile);
const unlinkAsync = promisify(fs.unlink);

const COOKIE_PATH = '/tmp/yt-cookies.txt';
const FRAME_DIR = '/tmp/yt2c-storage/frames';

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
    console.warn('[frame] Redis unavailable, running without cache');
    _redis = false;
    return null;
  }
}

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

function secondsToTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = s.toFixed(2).padStart(5, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { url, t } = req.query;
  if (!url || t == null) return res.status(400).json({ error: 'url and t are required' });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'invalid YouTube URL' });

  const seconds = parseFloat(t);
  if (isNaN(seconds) || seconds < 0) return res.status(400).json({ error: 'invalid time' });

  // Redis 캐시 확인 (프레임 이미지 자체를 base64로 캐시)
  const redis = await getRedis();
  const cacheKey = `ytframe2:${videoId}:${seconds}`;
  if (redis) {
    try {
      const cached = await redis.getBuffer(cacheKey);
      if (cached) {
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(cached);
      }
    } catch {}
  }

  const segId = `${videoId}-${seconds}-${Date.now()}`;
  const segPath = path.join(FRAME_DIR, `${segId}.mp4`);

  try {
    // 1단계: downloadYouTubeSegment (proxy retry 포함)로 1초 세그먼트 다운로드
    console.log('[frame] downloading segment at', seconds);
    await downloadYouTubeSegment(url, seconds, seconds + 1, segPath, null);

    // 2단계: 다운로드된 세그먼트에서 첫 프레임 추출
    const ffmpegArgs = [
      '-i', segPath,
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

    if (!frameBuffer || frameBuffer.length === 0) throw new Error('empty frame buffer');

    // Redis에 프레임 캐시 (1시간)
    if (redis) {
      try { await redis.set(cacheKey, frameBuffer, 'EX', 3600); } catch {}
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(frameBuffer);
  } catch (err) {
    const stderr = err.stderr || '';
    console.error('[frame]', err.message, stderr.slice(0, 500));
    res.status(500).json({ error: 'frame extraction failed', detail: err.message, stderr: stderr.slice(0, 1000) });
  } finally {
    // 임시 세그먼트 파일 정리
    try { await unlinkAsync(segPath); } catch {}
  }
}
