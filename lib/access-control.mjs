import {createHmac, timingSafeEqual} from 'node:crypto';

export const SESSION_COOKIE = 'youmeca_legacy_session';
export const SESSION_SECONDS = 60 * 60 * 24 * 7;
export function signSession(user, secret, now = Date.now()) {
  if (!secret || secret.length < 32) throw new Error('Access control is not configured');
  const payload = Buffer.from(JSON.stringify({uid:user.uid, email:user.email, exp:Math.floor(now/1000)+SESSION_SECONDS})).toString('base64url');
  return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');
}
export function readSession(token, secret, now = Date.now()) {
  if (!secret || secret.length < 32 || typeof token !== 'string' || token.length > 4096) return null;
  const parts=token.split('.'); if(parts.length!==2) return null;
  const expected=createHmac('sha256',secret).update(parts[0]).digest();
  const actual=Buffer.from(parts[1],'base64url');
  if(actual.length!==expected.length || !timingSafeEqual(actual,expected)) return null;
  try {
    const user=JSON.parse(Buffer.from(parts[0],'base64url').toString());
    return typeof user.uid==='string' && /^[a-zA-Z0-9_-]{1,128}$/.test(user.uid) && typeof user.email==='string' && Number.isFinite(user.exp) && user.exp>now/1000 ? user : null;
  } catch { return null; }
}
export function cookieToken(header='') {
  return header.split(';').map(part=>part.trim()).find(part=>part.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1) || '';
}
export function sessionCookie(token, secure=true) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token?SESSION_SECONDS:0}${secure?'; Secure':''}`;
}
export function isAdmin(user, adminUid) { return !!user && !!adminUid && user.uid===adminUid; }
export function accessState(user, record, adminUid) {
  if(!user) return {authenticated:false, approved:false, admin:false};
  const admin=isAdmin(user,adminUid);
  return {authenticated:true, approved:admin || record?.status==='approved', admin, uid:user.uid, email:user.email, status:admin?'approved':record?.status||'unrequested'};
}
export {blockedWebPath,sameOrigin} from './access-paths.mjs';
// Approval records are signed separately from sessions, so storage edits cannot grant rights.
export function signAccessRecord(record,secret) {
  if(!secret || secret.length<32) throw new Error('Access control is not configured');
  const data=Buffer.from(JSON.stringify(record)).toString('base64url');
  return JSON.stringify({data,signature:createHmac('sha256',secret).update('approval:'+data).digest('base64url')});
}
export function readAccessRecord(value,secret) {
  if(!value || !secret || secret.length<32) return null;
  try {
    const {data,signature}=JSON.parse(value);if(typeof data!=='string'||typeof signature!=='string')return null;
    const expected=createHmac('sha256',secret).update('approval:'+data).digest(),actual=Buffer.from(signature,'base64url');
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;
    const record=JSON.parse(Buffer.from(data,'base64url').toString());
    return typeof record.uid==='string'&&typeof record.email==='string'&&['pending','approved','revoked'].includes(record.status)?record:null;
  } catch {return null;}
}
