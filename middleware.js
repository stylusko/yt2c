import {NextResponse} from 'next/server';
import {retirementAction} from './lib/figmama-retirement.mjs';

export function middleware(request) {
  const action = retirementAction(request.nextUrl.pathname, request.method, request.nextUrl.searchParams.get('archive') === '1');
  if (action.kind === 'redirect') return NextResponse.redirect(action.destination, action.status);
  if (action.kind === 'closed') return NextResponse.json({
    error: '유메카의 새 카드뉴스 제작은 Figmama로 이전했습니다. Claude에서 내용을 구성하고 Figmama에서 디자인해 주세요.',
    migrationUrl: action.destination,
  }, {status: action.status, headers: {'Cache-Control': 'no-store', 'X-Youmeca-Migrated': 'Figmama'}});
  return NextResponse.next();
}
export const config = {matcher: ['/', '/easy', '/edit', '/ai-edit', '/bmonly/:path*', '/api/:path*']};
