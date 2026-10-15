import {NextResponse} from 'next/server';
import {retirementAction} from './lib/figmama-retirement.mjs';

export function middleware(request) {
  const action = retirementAction(request.nextUrl.pathname, request.method, request.nextUrl.searchParams.get('archive') === '1');
  if (action.kind === 'redirect') return NextResponse.redirect(action.destination, action.status);
  if (action.kind === 'closed') return NextResponse.json({
    error: '새 유메카에서 카드뉴스를 만드세요. Claude에서 내용을 구성하고 유메카에서 디자인할 수 있습니다.',
    migrationUrl: action.destination,
  }, {status: action.status, headers: {'Cache-Control': 'no-store', 'X-Youmeca-Migrated': 'Youmeca'}});
  return NextResponse.next();
}
export const config = {matcher: ['/', '/easy', '/edit', '/ai-edit', '/bmonly/:path*', '/api/:path*']};
