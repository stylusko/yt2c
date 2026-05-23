import Redis from 'ioredis';

const SHARE_TTL_SECONDS = 60 * 60 * 24 * 30;
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let redis = null;

function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (!redis) redis = new Redis(redisUrl, { maxRetriesPerRequest: null });
  return redis;
}

function keyFor(id) {
  return `yt2c:share:${id}`;
}

export async function saveShareToRedis(id, data) {
  const client = getRedis();
  if (!client) return false;
  await client.set(keyFor(id), data, 'EX', SHARE_TTL_SECONDS);
  return true;
}

export async function getShareFromRedis(id) {
  const client = getRedis();
  if (!client) return null;
  return client.get(keyFor(id));
}
