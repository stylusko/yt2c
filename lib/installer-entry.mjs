export const INSTALLER_TARGET='https://youmeca.web.app/download';
export function installerEntry(pathname,method,token) {
  if(!/^[a-f0-9]{36}$/.test(token||''))return null;
  const entry='/d/'+token;
  if(pathname!==entry&&pathname!==entry+'/file')return null;
  if(!['GET','HEAD'].includes(method))return {kind:'method',status:405};
  if(pathname===entry+'/file')return {kind:'download',status:307,destination:INSTALLER_TARGET};
  return {kind:'page',status:200,html:installerPage(entry)};
}
export function installerPage(entry) {
  if(!/^\/d\/[a-f0-9]{36}$/.test(entry))throw new Error('Invalid installer entry');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Youmeca 다운로드</title><style>*{box-sizing:border-box}body{margin:0;background:#f7f7f0;color:#263c2f;font:16px/1.65 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;min-height:100svh;display:grid;place-items:center;padding:28px}main{width:min(100%,480px);padding:44px 36px;background:#fff;border:1px solid #e1e5da;border-radius:24px}.brand{font-size:22px;font-weight:800;letter-spacing:-1px;margin:0 0 44px}h1{font-size:34px;line-height:1.2;letter-spacing:-1px;margin:0 0 14px}.description{color:#697461;margin:0 0 28px}.button{display:block;text-align:center;text-decoration:none;background:#334f3c;color:white;border-radius:12px;padding:15px 18px;font-weight:650}.button:hover{background:#243e2d}.button:focus-visible{outline:3px solid #e8b57e;outline-offset:4px}.platform{font-size:13px;color:#7a8373;text-align:center;margin:12px 0 0}.install{font-size:14px;color:#697461;border-top:1px solid #e6e9df;margin:32px 0 0;padding-top:22px}@media(max-width:480px){main{padding:32px 24px}h1{font-size:30px}.brand{margin-bottom:32px}}</style></head><body><main><p class="brand">youmeca</p><h1>카드뉴스를<br>내 Mac에서.</h1><p class="description">Youmeca Mac 앱을 다운로드하세요.</p><a class="button" href="${entry}/file">Mac 앱 다운로드 ↓</a><p class="platform">Apple Silicon Mac · macOS 13 이상</p><p class="install">받은 ZIP 파일의 압축을 풀고, Youmeca를 응용 프로그램 폴더로 옮겨 주세요.</p></main></body></html>`;
}
