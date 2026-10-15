import Redis from 'ioredis';
import {firebaseBackend,writeFirebaseObject,readFirebaseObject,legacyRef} from './firebase-runtime.mjs';

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
  if(firebaseBackend()) {await writeFirebaseObject('legacy-shares/'+id+'.txt',Buffer.from(data),'text/plain; charset=utf-8');await legacyRef('shares/'+id).set({createdAt:Date.now(),bytes:Buffer.byteLength(data)});return true;}
  const client = getRedis();
  if (!client) return false;
  await client.set(keyFor(id), data, 'EX', SHARE_TTL_SECONDS);
  return true;
}

export async function getShareFromRedis(id) {
  if(firebaseBackend()) {if(!/^[a-zA-Z0-9_-]{1,160}$/.test(id))return null;const data=await readFirebaseObject('legacy-shares/'+id+'.txt');return data?.toString()||null;}
  const client = getRedis();
  if (!client) return null;
  return client.get(keyFor(id));
}
