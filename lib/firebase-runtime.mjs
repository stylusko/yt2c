import {initializeApp,getApps,applicationDefault} from 'firebase-admin/app';
import {getDatabase,ServerValue} from 'firebase-admin/database';
import {getStorage} from 'firebase-admin/storage';
import {createHash} from 'node:crypto';
import {readSession,cookieToken} from './access-control.mjs';
export const firebaseBackend=()=>process.env.YOUMECA_BACKEND==='firebase';
export function firebaseApp() {
  const name='youmeca-legacy';
  return getApps().find(app=>app.name===name)||initializeApp({credential:applicationDefault(),projectId:'youmeca',databaseURL:process.env.YOUMECA_DATABASE_URL||'https://youmeca-default-rtdb.asia-southeast1.firebasedatabase.app',storageBucket:'youmeca.firebasestorage.app'},name);
}
export const legacyRef=path=>getDatabase(firebaseApp()).ref('legacyService/'+path);
export const firebaseBucket=()=>getStorage(firebaseApp()).bucket();
export const objectName=key=>'legacy/bucket/'+key;
export function validObjectKey(key) {return typeof key==='string'&&key.length<1024&&!key.includes('..')&&!key.includes('\\')&&!key.startsWith('/')&&!/[\x00-\x1f]/.test(key);}
export async function readFirebaseObject(key) {
  if(!validObjectKey(key))throw Error('Invalid object key');
  try {const [data]=await firebaseBucket().file(objectName(key)).download();return data;}
  catch(e) {if(e.code===404)return null;throw e;}
}
export async function writeFirebaseObject(key,data,contentType='application/octet-stream') {
  if(!validObjectKey(key))throw Error('Invalid object key');
  await firebaseBucket().file(objectName(key)).save(data,{resumable:false,metadata:{contentType,cacheControl:'private, no-store',metadata:{sha256:createHash('sha256').update(data).digest('hex')}}});return key;
}
export const signedInUser=req=>readSession(cookieToken(req.headers.cookie),process.env.YOUMECA_SESSION_SECRET);
export const hashKey=value=>createHash('sha256').update(String(value)).digest('hex');
export async function recordFirebaseVisit(req) {
  const {type,sessionId,cardCount,duration}=req.body||{};
  const today=new Date(Date.now()+9*3600_000).toISOString().slice(0,10);
  if(type==='cards'&&typeof sessionId==='string'&&sessionId.length<200&&Number.isFinite(cardCount))await legacyRef('stats/cardCounts/'+hashKey(sessionId)).set(Math.max(0,cardCount));
  if(type==='visit') {
    const ip=(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
    const result=await legacyRef('stats/knownVisitors/'+hashKey(ip)).transaction(current=>current?undefined:true);
    if(result.committed)await legacyRef('stats/newVisitors').set(ServerValue.increment(1));
    await legacyRef('stats/daily/'+today+'/visits').set(ServerValue.increment(1));
  }
  if(type==='duration'&&Number.isFinite(duration)&&duration>0&&duration<86400)await legacyRef('stats/daily/'+today).update({totalSeconds:ServerValue.increment(Math.round(duration)),sessions:ServerValue.increment(1)});
}
export async function firebaseStats() {
  const [baseline,fresh,cards]=await Promise.all(['stats/baselineVisitors','stats/newVisitors','stats/cardCounts'].map(p=>legacyRef(p).get()));
  return {visitors:200+(baseline.val()||0)+(fresh.val()||0),cards:200+Object.values(cards.val()||{}).reduce((n,v)=>n+(Number(v)||0),0)};
}
