# 유메카 Firebase 운영

기존 제작 화면과 승인 관리를 Firebase 프로젝트 `youmeca`로 이전했다. Firebase Hosting의 `youmeca-service` 사이트가 같은 프로젝트의 Cloud Run `youmeca-legacy`로 요청을 전달한다. 새 웹·Mac 편집기는 기존 `youmeca` Hosting 사이트와 공유 소스·릴리스 경로를 계속 사용한다.

## 서비스 구성

- 계정: 기존 Firebase Authentication 계정과 UID 유지.
- 승인·통계·작업 상태: Realtime Database의 서버 전용 `legacyService/` 경로. 기존 편집기 데이터와 분리하며 클라이언트 직접 접근 금지.
- 파일: `youmeca.firebasestorage.app`의 비공개 `legacy/bucket/` 경로. 로그인·승인을 확인하는 서버 경유로 다운로드. 영구 공개 다운로드 토큰을 만들지 않는다.
- 카드 이미지 생성: Cloud Tasks `youmeca-images`, 동시 2개, 최대 3회 시도. Google OIDC로 인증하는 내부 처리 경로.
- 비밀값: Secret Manager의 기존 참조 유지. 운영 서비스 계정은 `youmeca-web@youmeca.iam.gserviceaccount.com`.
- 서버: 싱가포르, 2 CPU·2GiB, 최소 0·최대 4 인스턴스. Railway·Redis·Supabase·S3 자격 증명이 필요 없다.

텍스트·링크 구성, 원문/사용자 사진, 사진 없는 카드, 기존 프로젝트 재열기·공유·JPG 제작을 지원한다. 새 영상 제작과 AI 이미지 생성은 제공하지 않는다. 기존 MP4 보관 파일의 다운로드는 유지한다. `/bmonly` 웹 진입은 차단한다. 관리자 승인 방식도 유지한다.

## 배포

이 저장소에서 `npm run deploy:firebase`를 실행한다. 먼저 기존 서비스와 계정을 확인하고 Cloud Build로 빌드한 뒤 이미지의 고정 digest를 배포한다. 기존 환경 설정·Secret Manager 참조·권한은 변경하지 않는다. 마지막에 Hosting 배포와 실제 상태 점검을 수행한다. 운영자에게 해당 프로젝트의 배포 권한이 있어야 한다.

새 편집기·Mac·MCP 배포는 별도 편집기 저장소의 기존 릴리스 경로를 사용한다. 서버 이전만으로 Mac 앱 버전을 올리거나 설치를 다시 요구하지 않는다.

로그인 쿠키는 Hosting이 전달하는 `__session`이며 HttpOnly·Secure·SameSite=Lax, 7일 유지다. 승인 취소는 다음 요청부터 적용한다. 4MB 이상 프로젝트·제작 요청은 승인된 사용자별 GCS 업로드 세션을 사용하여 Hosting 요청 크기 제한을 피한다. 최대 50MiB이며 소유자·용도·실제 크기를 완료 단계에서 확인한다.

## 검증 및 복구

배포 후 로그인·승인/취소·비공개 파일·기존 공유 자료·원문 사진/사진 없는 카드 제작·큰 프로젝트 업로드를 확인한다. `/api/health`는 비밀값을 노출하지 않고 DB·Storage 연결 상태만 반환한다.

서비스 이미지 변경은 이전에 확인된 digest로 `gcloud run deploy`하여 복구할 수 있다. 사용자 데이터는 이미지 복구와 독립적이다. Railway 원본은 중단 후에도 보존하며 재사용하려면 별도 운영자 조치가 필요하다.

이전 검증 기록은 편집기 작업 폴더의 `artifacts/youmeca-firebase-*.json`과 `docs/firebase-only-migration.md`에 보관한다. 기존 Supabase 주소가 이전 전부터 해석되지 않는 상태였으므로 해당 외부 서버의 확인 불가능한 이력을 복구했다고 주장하지 않는다. 현재 사용 가능한 Redis 공유 42개와 원본 버킷 888개는 전체 다운로드 해시를 검증했다.
