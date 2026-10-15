import {NextResponse} from 'next/server';
import {blockedWebPath,sameOrigin} from './lib/access-paths.mjs';

function noStore(response) {
  response.headers.set('Cache-Control','private, no-store');
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('X-Frame-Options','DENY');
  return response;
}
export async function middleware(request) {
  const originalPath=request.nextUrl.pathname,path=originalPath.toLowerCase();
  if(blockedWebPath(path)) return noStore(new NextResponse('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>웹 진입 중단 · 유메카</title><body style="font:17px/1.7 system-ui;background:#fafaf6;color:#263c2f;padding:12vh 8vw"><main><p>youmeca</p><h1>웹 진입이 중단되었습니다.</h1><p>배민온리 웹 페이지는 현재 이용할 수 없습니다.</p></main></body></html>',{status:403,headers:{'Content-Type':'text/html; charset=utf-8'}}));
  if(path==='/access' || path.startsWith('/api/access/') || path.startsWith('/_next/static/') || path.startsWith('/_next/webpack-hmr') || path==='/favicon.ico' || path.startsWith('/icon-') || path.startsWith('/fonts/')) return NextResponse.next();
  if(path.startsWith('/api/') && !['GET','HEAD','OPTIONS'].includes(request.method) && !sameOrigin(request.headers.get('origin'),process.env.YOUMECA_ORIGIN||'https://youmeca.me')) return noStore(NextResponse.json({error:'이 사이트에서 다시 요청해 주세요.'},{status:403}));
  let access;
  try {
    const port=process.env.PORT||'3000';
    if(!/^\d{1,5}$/.test(port)) throw new Error('Invalid port');
    const response=await fetch(`http://127.0.0.1:${port}/api/access/session`,{headers:{cookie:request.headers.get('cookie')||''},cache:'no-store',signal:AbortSignal.timeout(6000)});
    if(!response.ok) throw new Error('Access unavailable');
    access=await response.json();
  } catch {
    return noStore(new NextResponse('접근 권한을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}));
  }
  if(!access.approved) {
    if(path.startsWith('/api/') || path.startsWith('/_next/data/')) return noStore(NextResponse.json({error:access.authenticated?'관리자 승인이 필요합니다.':'로그인이 필요합니다.'},{status:access.authenticated?403:401}));
    const destination=new URL('/access',request.url);
    // Keep only local navigation paths. The archive query never changes access rights.
    destination.searchParams.set('next',originalPath+request.nextUrl.search);
    return noStore(NextResponse.redirect(destination,307));
  }
  if((path.startsWith('/admin/') || path.startsWith('/api/admin/')) && !access.admin) return noStore(new NextResponse('관리자만 이용할 수 있습니다.',{status:403}));
  return noStore(NextResponse.next());
}
export const config={matcher:['/:path*']};
