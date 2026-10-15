import {createHash} from 'node:crypto';
import {signAccessRecord,readAccessRecord} from './access-control.mjs';
const secret=()=>process.env.YOUMECA_SESSION_SECRET;
let connection;
const key='youmeca:legacy-access:v1';
export async function accessRedis() {
  if(!process.env.REDIS_URL) throw new Error('Access storage unavailable');
  if(!connection) {
    const {default:Redis}=await import('ioredis');
    connection=new Redis(process.env.REDIS_URL,{maxRetriesPerRequest:1,connectTimeout:3000,commandTimeout:4000,retryStrategy:()=>null});
    connection.on('error',()=>{});
  }
  return connection;
}
export async function recordFor(uid) {
  const value=await (await accessRedis()).hget(key,uid);
  const record=readAccessRecord(value,secret());return record?.uid===uid?record:null;
}
export async function requestAccess(user) {
  const redis=await accessRedis(),record={uid:user.uid,email:user.email,status:'pending',requestedAt:new Date().toISOString()};
  // A second request must never undo an administrator's approval or revocation.
  await redis.hsetnx(key,user.uid,signAccessRecord(record,secret()));
  return recordFor(user.uid);
}
export async function listAccess() {
  const records=await (await accessRedis()).hvals(key);
  return records.map(value=>readAccessRecord(value,secret())).filter(Boolean).sort((a,b)=>(b.requestedAt||'').localeCompare(a.requestedAt||''));
}
export async function decideAccess(uid,status,admin) {
  if(!['approved','revoked'].includes(status) || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) throw new Error('Invalid decision');
  const redis=await accessRedis();
  // Compare-and-set a verified record; concurrent requests cannot overwrite a decision.
  for(let attempt=0;attempt<3;attempt++) {
    const current=await redis.hget(key,uid),record=readAccessRecord(current,secret());
    if(!record || record.uid!==uid)return false;
    const next=signAccessRecord({...record,status,decidedBy:admin,decidedAt:new Date().toISOString()},secret());
    const saved=await redis.eval("if redis.call('HGET',KEYS[1],ARGV[1])~=ARGV[2] then return 0 end; redis.call('HSET',KEYS[1],ARGV[1],ARGV[3]); return 1",1,key,uid,current,next);
    if(saved===1)return true;
  }
  throw new Error('Concurrent access decision');
}
export async function loginRateLimited(address,email) {
  const redis=await accessRedis();
  const digest=createHash('sha256').update(address+'\0'+String(email).trim().toLowerCase()).digest('hex');
  const rateKey='youmeca:legacy-login-rate:'+digest;
  const count=await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],900) end; return n",1,rateKey);
  return count>15;
}
