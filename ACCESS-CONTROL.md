# 기존 유메카 접근 관리

- 기존 `youmeca.me`는 Firebase `youmeca`의 이메일 계정으로 로그인한 뒤 관리자의 승인을 받아야 이용할 수 있습니다.
- 관리자: 소유자가 지정한 `stylusko@gmail.com`의 기존 Firebase UID. 서버의 `YOUMECA_ADMIN_UID`로 고정하며 이메일 입력이나 브라우저 요청으로 관리자가 될 수 없습니다.
- `/access`에서 로그인과 승인 요청을 할 수 있고 `/admin/access`에서 관리자가 승인·거절·권한 회수를 처리합니다.
- 승인 목록은 기존 Railway Redis의 독립 해시 `youmeca:legacy-access:v1`에 만료 없이 저장됩니다. 승인 기록에도 서버 서명을 붙여 저장소 내용을 조작해 권한을 얻을 수 없습니다. 기존 프로젝트·작업 키는 변경하지 않습니다.
- 서버 서명 세션은 Secure/HttpOnly/SameSite=Lax 쿠키로 7일간 유지됩니다. 비밀번호·Firebase 토큰은 세션에 보관하지 않습니다. `YOUMECA_SESSION_SECRET`은 서버에만 저장합니다.
- 화면뿐 아니라 공유 링크·보관본·다운로드·생성 API에 매 요청마다 승인을 확인합니다. Redis/권한 서버 오류 시 차단하며 권한 회수는 다음 요청부터 적용됩니다.
- POST 요청은 `YOUMECA_ORIGIN`과 일치하는 Origin을 요구합니다. 브라우저 밖에서 사용자 쿠키를 이용한 API 호출도 동일합니다.
- `/bmonly`, 하위 경로, `/s/:id/bmonly`는 관리자를 포함해 HTTP 403입니다. `archive=1`과 인코딩된 경로로도 열리지 않습니다.
- 새 Firebase Hosting의 `/bmonly`와 하위 경로는 파일과 rewrite를 제거해 HTTP 404입니다. 기존 Figmama 도메인에서 이 주소로 연결되더라도 차단 화면으로 끝납니다.
- 새 유메카의 일반 `/app/`, Mac 앱, Claude MCP 및 업데이트 주소는 유지합니다. 배민온리 템플릿 자체나 저장 자료를 삭제하지 않습니다.

검증: `node scripts/test-access-control.mjs`, `node scripts/test-figmama-migration.mjs`, `npm run build` 및 실제 빌드 서버에서 비로그인·대기·승인·회수·관리자·CSRF·기존 보관본 시나리오를 확인합니다.
