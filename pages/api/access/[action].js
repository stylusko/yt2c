import {signSession,readSession,cookieToken,sessionCookie,accessState,sameOrigin} from '../../../lib/access-control.mjs';
import {recordFor,requestAccess,listAccess,decideAccess,loginRateLimited} from '../../../lib/access-store.mjs';

const API_KEY='AIzaSyB8ksit_PajKLQRvrBYrD1wC8btSaG3pIQ';
export const config={api:{bodyParser:{sizeLimit:'8kb'}}};
export default async function handler(req,res) {
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  const action=req.query.action,secret=process.env.YOUMECA_SESSION_SECRET,adminUid=process.env.YOUMECA_ADMIN_UID;
  if(!secret || secret.length<32 || !adminUid) return res.status(503).json({error:'접근 설정을 준비 중입니다. 잠시 후 다시 시도해 주세요.'});
  const mutation=['login','logout','request','decision'].includes(action);
  if(req.method!==(mutation?'POST':'GET')) {res.setHeader('Allow',mutation?'POST':'GET');return res.status(405).json({error:'허용하지 않는 요청입니다.'});}
  const expected=process.env.YOUMECA_ORIGIN || 'https://youmeca.me';
  const local=process.env.NODE_ENV!=='production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.origin||'');
  if(mutation && !sameOrigin(req.headers.origin,expected) && !local) return res.status(403).json({error:'이 사이트에서 다시 요청해 주세요.'});
  try {
    if(action==='logout') {res.setHeader('Set-Cookie',sessionCookie('',process.env.NODE_ENV==='production'));return res.json({ok:true});}
    if(action==='login') {
      const {email,password}=req.body||{};
      if(typeof email!=='string'||!email.trim()||email.length>254||typeof password!=='string'||!password||password.length>4096) return res.status(400).json({error:'이메일과 비밀번호를 입력해 주세요.'});
      if(await loginRateLimited(req.headers['x-forwarded-for']?.split(',')[0]||req.socket.remoteAddress||'',email)) return res.status(429).json({error:'로그인 시도가 많습니다. 15분 뒤 다시 시도해 주세요.'});
      const response=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+API_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim(),password,returnSecureToken:true}),signal:AbortSignal.timeout(12000)});
      const result=await response.json();
      if(!response.ok || !result.localId || !result.email) return res.status(401).json({error:'이메일과 비밀번호를 확인해 주세요. 기존 유메카 계정으로 로그인할 수 있습니다.'});
      // Identity is taken exclusively from Firebase's server response for project youmeca.
      const user={uid:result.localId,email:result.email};
      const state=accessState(user,await recordFor(user.uid),adminUid);
      res.setHeader('Set-Cookie',sessionCookie(signSession(user,secret),process.env.NODE_ENV==='production'));
      return res.json(state);
    }
    const user=readSession(cookieToken(req.headers.cookie),secret);
    const state=accessState(user,user?await recordFor(user.uid):null,adminUid);
    if(action==='session') return res.json(state);
    if(!user) return res.status(401).json({error:'먼저 로그인해 주세요.'});
    if(action==='request') {await requestAccess(user);return res.json(accessState(user,await recordFor(user.uid),adminUid));}
    if(!state.admin) return res.status(403).json({error:'관리자만 이용할 수 있습니다.'});
    if(action==='users') return res.json({users:await listAccess()});
    if(action==='decision') {
      const {uid,status}=req.body||{};
      if(uid===adminUid || typeof uid!=='string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid) || !['approved','revoked'].includes(status)) return res.status(400).json({error:'승인할 사용자를 확인해 주세요.'});
      if(!await decideAccess(uid,status,user.uid)) return res.status(404).json({error:'해당 사용자의 승인 요청을 찾을 수 없습니다.'});
      return res.json({ok:true});
    }
    return res.status(404).json({error:'찾을 수 없는 요청입니다.'});
  } catch {
    // Do not log credentials, session cookies, tokens or Firebase responses.
    return res.status(503).json({error:'접근 권한을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'});
  }
}
