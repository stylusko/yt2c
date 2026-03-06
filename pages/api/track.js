import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let _redis = null;
function getRedis() {
  if (!_redis) _redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  return _redis;
}

function getKSTDateStr(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const redis = getRedis();
    const ip = getClientIP(req);
    const dateStr = getKSTDateStr();
    const { type, duration } = req.body || {};

    if (type === 'visit') {
      // Add IP to daily visitor set
      const key = `yt2c:visitors:daily:${dateStr}`;
      await redis.sadd(key, ip);
      await redis.expire(key, 90 * 24 * 60 * 60);
    } else if (type === 'duration' && typeof duration === 'number' && duration > 0) {
      // Record session duration (seconds)
      const key = `yt2c:duration:daily:${dateStr}`;
      const pipe = redis.pipeline();
      pipe.hincrby(key, 'totalSeconds', Math.round(duration));
      pipe.hincrby(key, 'sessions', 1);
      pipe.expire(key, 90 * 24 * 60 * 60);
      await pipe.exec();
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[track] error:', err.message);
    return res.status(200).json({ ok: true });
  }
}
