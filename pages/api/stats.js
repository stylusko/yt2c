import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let _redis = null;
function getRedis() {
  if (!_redis) _redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  return _redis;
}

const ALLTIME_VISITORS_KEY = 'yt2c:visitors:alltime';
const ALLTIME_BACKFILL_FLAG = 'yt2c:visitors:alltime:backfilled';

// 기존 일별 visitor 데이터(yt2c:visitors:daily:YYYY-MM-DD)를 HyperLogLog로 1회 backfill.
// TTL 때문에 최대 90일치만 backfill 가능 (그 이전 IP는 복원 불가).
async function backfillAlltimeVisitorsOnce(redis) {
  const flag = await redis.get(ALLTIME_BACKFILL_FLAG);
  if (flag) return;
  try {
    let cursor = '0';
    const merged = [];
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', 'yt2c:visitors:daily:*', 'COUNT', 200);
      cursor = next;
      if (keys.length) merged.push(...keys);
    } while (cursor !== '0');
    if (merged.length > 0) {
      // 일별 visitor set들의 IP들을 HLL에 추가
      const pipe = redis.pipeline();
      for (const setKey of merged) {
        const ips = await redis.smembers(setKey);
        if (ips.length) pipe.pfadd(ALLTIME_VISITORS_KEY, ...ips);
      }
      await pipe.exec();
    }
    await redis.set(ALLTIME_BACKFILL_FLAG, '1');
  } catch (e) {
    console.warn('[stats] alltime backfill failed:', e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const redis = getRedis();
    await backfillAlltimeVisitorsOnce(redis);

    const [allTimeVisitors, cardVals] = await Promise.all([
      redis.pfcount(ALLTIME_VISITORS_KEY),
      redis.hvals('yt2c:cardcounts'),
    ]);
    const totalCards = cardVals.reduce((sum, v) => sum + parseInt(v || '0', 10), 0);

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    res.json({ visitors: allTimeVisitors, cards: totalCards });
  } catch (e) {
    console.error('[stats] error:', e.message);
    res.json({ visitors: 0, cards: 0 });
  }
}
