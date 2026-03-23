#!/bin/bash
# stylusko GitHub 전체 레포 클론 스크립트
# 새 컴퓨터에서 실행하세요.
#
# 사전 준비:
#   1. git 설치
#   2. gh (GitHub CLI) 설치: https://cli.github.com/
#   3. gh auth login 으로 인증

set -euo pipefail

GITHUB_USER="stylusko"
TARGET_DIR="${1:-$HOME/github}"

echo "=== GitHub 전체 레포 클론 스크립트 ==="
echo "대상 디렉토리: $TARGET_DIR"
echo ""

# gh CLI 확인
if ! command -v gh &> /dev/null; then
    echo "❌ gh (GitHub CLI)가 설치되어 있지 않습니다."
    echo "설치: https://cli.github.com/"
    exit 1
fi

# 인증 확인
if ! gh auth status &> /dev/null; then
    echo "❌ GitHub 인증이 필요합니다. 먼저 실행하세요:"
    echo "   gh auth login"
    exit 1
fi

mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

echo "레포 목록 가져오는 중..."
# public + private 모두 포함, owner 본인 레포만
REPOS=$(gh repo list "$GITHUB_USER" --limit 200 --json name,sshUrl,isPrivate --jq '.[] | "\(.name)\t\(.sshUrl)\t\(.isPrivate)"')

TOTAL=$(echo "$REPOS" | wc -l)
echo "총 ${TOTAL}개 레포 발견"
echo ""

COUNT=0
SKIPPED=0

while IFS=$'\t' read -r NAME SSH_URL IS_PRIVATE; do
    COUNT=$((COUNT + 1))
    LABEL=""
    if [ "$IS_PRIVATE" = "true" ]; then
        LABEL=" [private]"
    fi

    if [ -d "$NAME" ]; then
        echo "[$COUNT/$TOTAL] $NAME${LABEL} — 이미 존재, 건너뜀 (pull 하려면 아래 참고)"
        SKIPPED=$((SKIPPED + 1))
    else
        echo "[$COUNT/$TOTAL] $NAME${LABEL} — 클론 중..."
        gh repo clone "$GITHUB_USER/$NAME" "$NAME" -- --depth=1 2>&1 || {
            echo "  ⚠️  클론 실패: $NAME"
        }
    fi
done <<< "$REPOS"

CLONED=$((COUNT - SKIPPED))
echo ""
echo "=== 완료 ==="
echo "클론: ${CLONED}개 / 건너뜀: ${SKIPPED}개 / 전체: ${TOTAL}개"
echo "위치: $TARGET_DIR"
echo ""
echo "💡 전체 히스토리가 필요하면 해당 레포에서: git fetch --unshallow"
echo "💡 이미 있는 레포 업데이트: cd <repo> && git pull"
