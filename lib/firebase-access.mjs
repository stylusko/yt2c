import {legacyRef,hashKey} from './firebase-runtime.mjs';
import {signAccessRecord,readAccessRecord} from './access-control.mjs';
const secret=()=>process.env.YOUMECA_SESSION_SECRET;
const ref=uid=>legacyRef('approvals/'+uid);
export async function recordFor(uid) {const record=readAccessRecord((await ref(uid).get()).val(),secret());return record?.uid===uid?record:null;}
export async function requestAccess(user) {
  const signed=signAccessRecord({uid:user.uid,email:user.email,status:'pending',requestedAt:new Date().toISOString()},secret());
  await ref(user.uid).transaction(current=>current===null?signed:undefined);return recordFor(user.uid);
}
export async function listAccess() {return Object.values((await legacyRef('approvals').get()).val()||{}).map(v=>readAccessRecord(v,secret())).filter(Boolean).sort((a,b)=>(b.requestedAt||'').localeCompare(a.requestedAt||''));}
export async function decideAccess(uid,status,admin) {
  if(!['approved','revoked'].includes(status)||!/^[a-zA-Z0-9_-]{1,128}$/.test(uid))throw Error('Invalid decision');
  const result=await ref(uid).transaction(current=>{if(current===null)return null;const record=readAccessRecord(current,secret());if(!record||record.uid!==uid)return;return signAccessRecord({...record,status,decidedBy:admin,decidedAt:new Date().toISOString()},secret());});return result.committed&&result.snapshot.exists();
}
export async function loginRateLimited(address,email) {
  const r=await legacyRef('loginRates/'+hashKey(address+'\0'+String(email).trim().toLowerCase())).transaction(current=>{const now=Date.now();return !current||current.expiresAt<=now?{count:1,expiresAt:now+900_000}:{count:current.count+1,expiresAt:current.expiresAt};});return r.snapshot.val().count>15;
}
