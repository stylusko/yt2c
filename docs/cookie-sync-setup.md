# YouTube 쿠키 자동 갱신 설정 가이드

항상 켜져 있는 맥북에서 YouTube 쿠키를 자동으로 추출하여 서버(Railway)에 업데이트하는 방법입니다.

> **왜 필요한가요?**
> 서버에서 YouTube 영상을 다운로드하려면 로그인 쿠키가 필요합니다.
> 쿠키는 약 2주면 만료되기 때문에, 자동으로 갱신해줘야 합니다.

---

## 목차

1. [준비물](#1-준비물)
2. [서브 Google 계정 만들기](#2-서브-google-계정-만들기)
3. [Firefox 설치 및 로그인](#3-firefox-설치-및-로그인)
4. [Railway 설정값 확인하기](#4-railway-설정값-확인하기)
5. [스크립트 설정하기](#5-스크립트-설정하기)
6. [수동 테스트](#6-수동-테스트)
7. [자동 실행 등록 (cron)](#7-자동-실행-등록-cron)
8. [맥북 절전 방지 설정](#8-맥북-절전-방지-설정)
9. [문제 해결](#9-문제-해결)

---

## 1. 준비물

- **항상 켜져 있는 맥북** 1대
- **Firefox 브라우저** (Chrome 아님, 반드시 Firefox)
- **서브용 Google 계정** 1개 (메인 계정 사용 금지 — 아래 설명 참고)

---

## 2. 서브 Google 계정 만들기

> **중요: 왜 서브 계정인가요?**
> 이 과정에서 쿠키(로그인 정보)를 추출하여 서버로 전송합니다.
> 만약 쿠키가 유출되면 해당 계정에 로그인한 것과 같은 효과가 있으므로,
> 개인 메인 계정이 아닌 **전용 서브 계정**을 사용해야 안전합니다.

### 계정 생성 방법

1. 브라우저에서 [accounts.google.com](https://accounts.google.com) 접속
2. **"계정 만들기"** 클릭
3. 적당한 이름과 이메일 주소 입력 (예: `yt2c.bot.2026@gmail.com`)
4. 비밀번호 설정 후 계정 생성 완료
5. [youtube.com](https://youtube.com) 에 접속하여 해당 계정으로 로그인 확인

> 이 계정은 YouTube에 로그인만 되어 있으면 됩니다.
> 구독, 시청기록 등은 전혀 필요 없습니다.

---

## 3. Firefox 설치 및 로그인

### 3-1. Firefox 설치

맥북에 Firefox가 없다면:

1. [firefox.com](https://www.mozilla.org/firefox/) 접속
2. **"Firefox 다운로드"** 클릭
3. 다운받은 `.dmg` 파일 실행 → Firefox를 **응용 프로그램** 폴더로 드래그
4. Firefox 실행

### 3-2. YouTube 로그인

1. Firefox에서 [youtube.com](https://youtube.com) 접속
2. 오른쪽 상단 **"로그인"** 클릭
3. **2단계에서 만든 서브 계정**으로 로그인
4. 로그인 완료 후 YouTube 메인 페이지가 보이면 성공

> **주의:** Firefox를 종료해도 괜찮습니다. 쿠키는 파일에 저장되어 있어서 Firefox가 꺼져 있어도 추출 가능합니다.
> 단, 가끔(2주에 한 번 정도) Firefox를 열어 YouTube에 접속하면 쿠키 수명이 자동 연장됩니다.

---

## 4. Railway 설정값 확인하기

스크립트에 입력해야 할 값이 4개 있습니다. Railway 대시보드에서 확인합니다.

### 4-1. API 토큰 생성

1. [railway.app](https://railway.app) 로그인
2. 오른쪽 상단 프로필 아이콘 클릭 → **"Account Settings"**
3. 왼쪽 메뉴에서 **"Tokens"** 클릭
4. **"Create Token"** 클릭
5. 이름: `cookie-sync` (아무거나 OK)
6. 생성된 토큰을 **복사해서 메모장에 저장** (한 번만 보여줍니다!)

> 이 값이 `RAILWAY_API_TOKEN` 입니다.

### 4-2. 프로젝트/환경/서비스 ID 확인

1. Railway 대시보드에서 프로젝트 클릭
2. 서비스(yt2c-web) 클릭
3. **"Settings"** 탭 클릭
4. 브라우저 주소창의 URL을 확인합니다:

```
https://railway.app/project/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx/service/yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy/settings
```

- `xxxxxxxx-...` 부분 = **`RAILWAY_PROJECT_ID`** (프로젝트 ID)
- `yyyyyyyy-...` 부분 = **`RAILWAY_SERVICE_ID`** (서비스 ID)

5. 환경 ID 확인: 같은 페이지에서 상단에 **"production"** 환경이 선택되어 있는지 확인
   - **"Variables"** 탭 클릭
   - 브라우저 주소창 URL에서 `environmentId=zzzzzzzz-...` 부분 확인
   - 이 값이 **`RAILWAY_ENVIRONMENT_ID`** 입니다

> URL에 environmentId가 안 보이면, Railway CLI로 확인:
> ```bash
> railway environment
> ```

### 확인한 4개 값 정리

| 항목 | 예시 |
|---|---|
| `RAILWAY_API_TOKEN` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `RAILWAY_PROJECT_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `RAILWAY_ENVIRONMENT_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `RAILWAY_SERVICE_ID` | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |

---

## 5. 스크립트 설정하기

### 5-1. 프로젝트 다운로드

맥북에서 **터미널** 앱을 엽니다.

> **터미널 여는 법:** `Cmd + Space` → "터미널" 입력 → Enter

아래 명령어를 한 줄씩 복사하여 터미널에 붙여넣고 Enter:

```bash
cd ~/Desktop
git clone https://github.com/stylusko/yt2c.git
cd yt2c
```

### 5-2. 스크립트에 설정값 입력

터미널에서 아래 명령어로 스크립트를 엽니다:

```bash
nano scripts/sync-cookies.sh
```

파일이 열리면 상단에 아래 부분을 찾습니다:

```bash
RAILWAY_API_TOKEN=""
RAILWAY_PROJECT_ID=""
RAILWAY_ENVIRONMENT_ID=""
RAILWAY_SERVICE_ID=""
```

4단계에서 확인한 값을 큰따옴표 안에 붙여넣습니다:

```bash
RAILWAY_API_TOKEN="여기에_API_토큰_붙여넣기"
RAILWAY_PROJECT_ID="여기에_프로젝트_ID_붙여넣기"
RAILWAY_ENVIRONMENT_ID="여기에_환경_ID_붙여넣기"
RAILWAY_SERVICE_ID="여기에_서비스_ID_붙여넣기"
```

저장하고 나가기:
1. `Ctrl + O` → Enter (저장)
2. `Ctrl + X` (나가기)

### 5-3. 필요 도구 설치

터미널에서 아래 명령어 실행:

```bash
# jq 설치 (JSON 처리 도구)
brew install jq

# brew가 없다면 먼저 Homebrew 설치:
# /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

---

## 6. 수동 테스트

설정이 끝났으면 먼저 수동으로 테스트합니다:

```bash
bash ~/Desktop/yt2c/scripts/sync-cookies.sh
```

### 성공하면 이렇게 출력됩니다:

```
Firefox 쿠키 DB: /Users/.../cookies.sqlite
추출된 쿠키: 42개
Railway API로 YT_COOKIES_B64 업데이트 중...
SUCCESS: YT_COOKIES_B64 업데이트 완료 (2026-03-14 10:30:00)
```

### 에러가 나면?

| 에러 메시지 | 해결 방법 |
|---|---|
| `Firefox cookies.sqlite를 찾을 수 없습니다` | Firefox 설치 확인, YouTube 한 번이라도 접속했는지 확인 |
| `Railway 설정값을 모두 채워 넣어야 합니다` | 5-2 단계 다시 확인 |
| `Railway API 요청 실패` | API 토큰이 올바른지, ID 값이 맞는지 확인 |
| `쿠키가 너무 적습니다` | Firefox에서 YouTube에 로그인되어 있는지 확인 |

---

## 7. 자동 실행 등록 (cron)

매일 **오전 9시, 오후 9시**에 자동 실행되도록 설정합니다.

### 7-1. cron 편집

터미널에서:

```bash
crontab -e
```

> 처음 실행하면 에디터를 선택하라고 나올 수 있습니다. `nano`를 선택하세요.

### 7-2. 아래 한 줄 추가

```
0 9,21 * * * /bin/bash $HOME/Desktop/yt2c/scripts/sync-cookies.sh >> /tmp/cookies-sync.log 2>&1
```

> **경로 확인:** 만약 프로젝트를 Desktop이 아닌 다른 곳에 clone했다면, 경로를 맞게 수정하세요.

저장하고 나가기:
1. `Ctrl + O` → Enter
2. `Ctrl + X`

### 7-3. 등록 확인

```bash
crontab -l
```

위에서 입력한 줄이 보이면 성공입니다.

### 7-4. cron 디스크 접근 권한 허용

macOS는 보안 정책상 cron에 디스크 접근 권한을 별도로 줘야 합니다.

1. **시스템 설정** 열기 (`Cmd + Space` → "시스템 설정")
2. **개인정보 보호 및 보안** → **전체 디스크 접근 권한**
3. 좌측 하단 **자물쇠** 클릭하여 잠금 해제
4. **+** 버튼 클릭
5. `Cmd + Shift + G`를 눌러 경로 입력: `/usr/sbin/cron`
6. `cron`을 선택하여 추가
7. 체크박스가 켜져 있는지 확인

> 이 권한이 없으면 cron이 Firefox 쿠키 파일을 읽지 못합니다.

---

## 8. 맥북 절전 방지 설정

맥북이 잠자기 모드에 들어가면 cron이 실행되지 않습니다.

### 방법 A: 시스템 설정 (간단)

1. **시스템 설정** → **에너지 절약** (또는 **배터리** → **전원 어댑터**)
2. **"디스플레이가 꺼져 있을 때 자동으로 잠자기 방지"** → **켜기**
3. 전원 어댑터에 항상 연결해두기

### 방법 B: 터미널 명령어

```bash
# 맥북이 절전 모드에 들어가지 않도록 설정 (전원 연결 시)
sudo pmset -c sleep 0 disksleep 0
```

> 비밀번호를 물어보면 맥북 로그인 비밀번호를 입력하세요.

---

## 9. 문제 해결

### 로그 확인하기

자동 실행 결과는 로그 파일에 저장됩니다:

```bash
cat /tmp/cookies-sync.log
```

최근 실행 결과만 보려면:

```bash
tail -20 /tmp/cookies-sync.log
```

### 쿠키가 만료되는 경우

Firefox에서 YouTube를 주기적으로 방문하면 쿠키가 자동 연장됩니다.
가끔(2주에 1번 정도) Firefox를 열어서 YouTube를 한번 방문해주세요.

### 스크립트가 실행 안 되는 경우

1. **cron 등록 확인:** `crontab -l`
2. **디스크 권한 확인:** 7-4 단계 다시 확인
3. **맥북 절전 확인:** 전원 어댑터 연결 + 절전 방지 설정 확인
4. **수동 실행 테스트:** `bash ~/Desktop/yt2c/scripts/sync-cookies.sh`

### Railway 환경변수 확인

Railway 대시보드에서 해당 서비스의 **Variables** 탭에서 `YT_COOKIES_B64` 값이 최근에 업데이트되었는지 확인할 수 있습니다.

---

## 요약

| 항목 | 내용 |
|---|---|
| 실행 맥북 | 항상 켜져 있는 맥북 (전원 어댑터 연결) |
| YouTube 계정 | 서브 계정 사용 (메인 계정 금지) |
| 브라우저 | Firefox (YouTube 로그인 상태 유지) |
| 자동 실행 | 매일 오전 9시, 오후 9시 (cron) |
| 로그 확인 | `cat /tmp/cookies-sync.log` |
