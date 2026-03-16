# yt2c-web

YouTube 영상 구간을 카드뉴스(이미지/영상)로 변환하는 풀스택 SaaS.

## Communication
- 반드시 한국어로만 대화할 것

## Commands
```bash
npm run dev        # 로컬 개발 서버 (포트 3000)
npm run build      # 프로덕션 빌드
npm start          # 프로덕션 서버
node worker.js     # BullMQ 워커 (별도 프로세스)
```

## Tech Stack
- Next.js 14 (Pages Router) + React 18
- React.createElement 직접 사용 (JSX 미사용) — 이 패턴을 유지할 것
- BullMQ + Redis (작업 큐), Supabase (공유 링크)
- yt-dlp + ffmpeg (영상 처리), Docker → Railway 배포

## Architecture

IMPORTANT: `pages/index.js` 단일 파일(6500줄+)에 모든 프론트엔드 UI 포함.

### 레이아웃 탭 3곳 중복 — 반드시 동기화
기능 추가/수정 시 아래 3곳 모두 확인 필수:
1. Section 기반 렌더링 (~line 1408)
2. `renderLayoutTab()` — 모바일
3. `renderLayout()` — 데스크톱

### 핵심 파일
| 파일 | 역할 |
|------|------|
| `pages/index.js` | 전체 UI + 상태 관리 |
| `lib/worker.js` | ffmpeg 필터 체인, yt-dlp 다운로드 |
| `worker.js` | BullMQ Worker 진입점 |
| `lib/queue.js` | BullMQ Queue 싱글톤 |
| `Dockerfile` | 3개 프로세스: bgutil POT + Worker + Next.js |

## Gotchas

IMPORTANT: 아래 함정을 반드시 숙지할 것.

- **유니코드 한글**: 코드에 `\uXXXX` 형태로 저장된 한글이 섞여 있음. grep만 믿지 말고 `MOBILE_TABS`, `DESKTOP_TABS` 등 상수 배열을 직접 확인
- **youtube-nocookie.com 금지**: postMessage origin 불일치로 IFrame API 통신 깨짐
- **CARD_KEY_MAP 호환성**: 새 카드 필드 추가 시 `CARD_KEY_MAP`에 매핑 추가 필수 (기존 공유 URL 깨짐 방지)
- **ffmpeg 좌표 공식**: 프론트엔드 videoX/Y(-400~400) → 백엔드 pixel 변환은 `computePixelPos()` 함수 참조. 프론트/백 정렬 필수
- **짝수 해상도**: ffmpeg yuv420p는 짝수 치수만 지원. `even()` 헬퍼 사용

## Workflow
1. main에서 feature 브랜치 생성 (예: `feat/zoom-controls`)
2. 커밋+푸시+PR → Railway 프리뷰 자동 배포
3. 추가 수정 → 같은 브랜치에 커밋+푸시 (프리뷰 재배포)
4. 유저가 "머지해" → PR 머지 (production 배포)
5. 머지 후 `git checkout main && git pull origin main`

## Versioning
- `BUILD_DATE`: `'YYYY.MMDD'` 형식
- `BUILD_NUM`: 같은 날 배포 횟수. 날짜 변경 시 1로 리셋
- 배포 시 `pages/index.js` 상단의 `BUILD_DATE`, `BUILD_NUM` 업데이트
- `RECENT_FEATURES`: 최근 5~7개 유지, 오래된 항목 제거
