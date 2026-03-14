#!/bin/bash
# Firefox cookies.sqlite → base64 → Railway API 자동 업데이트
#
# 사전 준비:
#   1. Railway 대시보드 > Account Settings > Tokens 에서 API 토큰 생성
#   2. 스크립트 상단의 4개 변수를 채워 넣기
#
# 사용법:
#   bash scripts/sync-cookies.sh
#
# cron 자동 실행 (3일마다):
#   crontab -e
#   0 10 */3 * * /path/to/scripts/sync-cookies.sh >> /tmp/cookies-sync.log 2>&1

set -euo pipefail

# ──────────────────────────────────────────────
# Railway 설정 (직접 기입)
# ──────────────────────────────────────────────
RAILWAY_API_TOKEN=""
RAILWAY_PROJECT_ID=""
RAILWAY_ENVIRONMENT_ID=""
RAILWAY_SERVICE_ID=""

# ──────────────────────────────────────────────
# 검증
# ──────────────────────────────────────────────
if [[ -z "$RAILWAY_API_TOKEN" || -z "$RAILWAY_PROJECT_ID" || -z "$RAILWAY_ENVIRONMENT_ID" || -z "$RAILWAY_SERVICE_ID" ]]; then
  echo "ERROR: 스크립트 상단의 Railway 설정값을 모두 채워 넣어야 합니다."
  exit 1
fi

# ──────────────────────────────────────────────
# 1. Firefox 프로필 자동 탐색
# ──────────────────────────────────────────────
FF_PROFILES_DIR="$HOME/Library/Application Support/Firefox/Profiles"
COOKIES_DB=$(find "$FF_PROFILES_DIR" -maxdepth 2 -name "cookies.sqlite" -path "*.default*" 2>/dev/null | head -1)

if [[ -z "$COOKIES_DB" ]]; then
  echo "ERROR: Firefox cookies.sqlite를 찾을 수 없습니다."
  echo "       경로: $FF_PROFILES_DIR/*.default*/cookies.sqlite"
  exit 1
fi

echo "Firefox 쿠키 DB: $COOKIES_DB"

# ──────────────────────────────────────────────
# 2. DB 복사 (Firefox 락 방지) + 쿠키 추출
# ──────────────────────────────────────────────
TEMP_DB=$(mktemp /tmp/ff-cookies-XXXXXX.sqlite)
cp "$COOKIES_DB" "$TEMP_DB"

# WAL/SHM 파일도 복사 (있으면)
for ext in wal shm; do
  if [[ -f "${COOKIES_DB}-${ext}" ]]; then
    cp "${COOKIES_DB}-${ext}" "${TEMP_DB}-${ext}"
  fi
done

COOKIES_TXT=$(mktemp /tmp/yt-cookies-XXXXXX.txt)

# Netscape 형식으로 youtube.com / google.com 쿠키 추출
echo "# Netscape HTTP Cookie File" > "$COOKIES_TXT"
sqlite3 "$TEMP_DB" <<'SQL' >> "$COOKIES_TXT"
SELECT
  CASE WHEN host LIKE '.%' THEN host ELSE '.' || host END,
  'TRUE',
  path,
  CASE WHEN isSecure THEN 'TRUE' ELSE 'FALSE' END,
  expiry,
  name,
  value
FROM moz_cookies
WHERE host LIKE '%youtube.com' OR host LIKE '%google.com'
ORDER BY host, name;
SQL

# 임시 DB 정리
rm -f "$TEMP_DB" "${TEMP_DB}-wal" "${TEMP_DB}-shm"

COOKIE_COUNT=$(grep -c -v '^#' "$COOKIES_TXT" 2>/dev/null || echo "0")
echo "추출된 쿠키: ${COOKIE_COUNT}개"

if [[ "$COOKIE_COUNT" -lt 5 ]]; then
  echo "WARNING: 쿠키가 너무 적습니다. Firefox에서 YouTube에 로그인되어 있는지 확인하세요."
fi

# ──────────────────────────────────────────────
# 3. base64 인코딩
# ──────────────────────────────────────────────
COOKIES_B64=$(base64 < "$COOKIES_TXT")
rm -f "$COOKIES_TXT"

# ──────────────────────────────────────────────
# 4. Railway API로 환경변수 업데이트
# ──────────────────────────────────────────────
echo "Railway API로 YT_COOKIES_B64 업데이트 중..."

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST https://backboard.railway.app/graphql/v2 \
  -H "Authorization: Bearer $RAILWAY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg projectId "$RAILWAY_PROJECT_ID" \
    --arg environmentId "$RAILWAY_ENVIRONMENT_ID" \
    --arg serviceId "$RAILWAY_SERVICE_ID" \
    --arg value "$COOKIES_B64" \
    '{
      query: "mutation variableUpsert($input: VariableUpsertInput!) { variableUpsert(input: $input) }",
      variables: {
        input: {
          projectId: $projectId,
          environmentId: $environmentId,
          serviceId: $serviceId,
          name: "YT_COOKIES_B64",
          value: $value
        }
      }
    }'
  )"
)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [[ "$HTTP_CODE" == "200" ]] && echo "$BODY" | jq -e '.data.variableUpsert' > /dev/null 2>&1; then
  echo "SUCCESS: YT_COOKIES_B64 업데이트 완료 ($(date '+%Y-%m-%d %H:%M:%S'))"
else
  echo "ERROR: Railway API 요청 실패 (HTTP $HTTP_CODE)"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi
