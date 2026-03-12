import Redis from 'ioredis';
import { getStats } from '../../lib/telegram';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let _redis = null;
function getRedis() {
  if (!_redis) _redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  return _redis;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const [stats, cardVals] = await Promise.all([
      getStats('month'),
      getRedis().hvals('yt2c:cardcounts'),
    ]);
    const totalCards = cardVals.reduce((sum, v) => sum + parseInt(v || '0', 10), 0);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.json({ visitors: stats.totalVisitors, cards: totalCards });
  } catch (e) {
    res.json({ visitors: 0, cards: 0 });
  }
}
