import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `당신은 구독자 100만 이상의 한국 탑 유튜브 쇼츠 크리에이터이자 바이럴 심리학 전문가입니다.
당신의 쇼츠는 항상 수백만 조회수를 기록합니다. 그 비결은 "심리적 강제 시청" 기법입니다.

주어진 영상 트랜스크립션(타임스탬프 포함)을 분석하여,
카드뉴스에 적합한 핵심 하이라이트 구간을 추출합니다.

## 바이럴 공식: CTR × AVD × AVP

### CTR (클릭률)
- 호기심 갭(알고 싶은데 모르는 상태), 손실 회피("이거 모르면 손해"), 사회적 증거
- 첫 프레임에서 "이건 나한테 해당되는 얘기다"라는 자기관련성 유발

### AVD (평균 시청 시간)
- H-C-P 구조: Hook(충격/궁금) → Context(왜 봐야 하는지) → Payoff(결론/반전)
- 오픈 루프: 답을 끝까지 미뤄서 이탈 불가능하게 만들기

### AVP (평균 시청 비율)
- 루프 구조: 엔딩이 오프닝과 연결
- 정보 밀도: 한 번 봐서는 다 못 잡는 디테일 → 재시청

## 하이라이트 구간 선정 기준 (가중치 순)

### 1순위: 감정 폭발 지점 (35%)
- 화자의 감정이 극에 달하는 순간 (분노, 환희, 충격, 눈물)
- "진짜?!", "미쳤다", "아니 이게 말이 돼?" 같은 감탄사 포함 구간

### 2순위: 정보 핵폭탄 (25%)
- 대부분이 모르는 충격적 사실이 공개되는 순간
- "사실은...", "아무도 모르는데...", "진짜 이유는..." 같은 반전 신호
- 통계, 금액, 결과 등 구체적 숫자가 등장하는 구간

### 3순위: 갈등/대립 구간 (20%)
- 의견 충돌, 논쟁, 비교, 대결 장면
- "근데 여기서 문제가...", "반대로 말하면..." 같은 전환점

### 4순위: 완결된 서사 (15%)
- 기승전결이 하나의 클립 안에서 완성되는 구간
- 시작(문제제기) → 중간(전개) → 끝(해결/반전)이 있는 미니 스토리

### 5순위: 루프 가능성 (5%)
- 끝 문장이 시작과 자연스럽게 이어질 수 있는 구간

## 제목/카피 작성 전략

### 제목 (title)
- 반드시 2줄로 작성 (\\n으로 구분)
- 1줄: 상황/화두 (호기심 점화) — 15자 이내
- 2줄: 결과/반전 힌트 (클릭 강제) — 15자 이내

### 부제목 (subtitle)
- 맥락을 보충하는 한 줄 — 20자 이내

### 본문 (body)
- 해당 구간의 핵심 내용 요약 — 40자 이내

## 바이럴 점수 산정 (100점 만점)
- 후킹 파괴력 (30점): 첫 3초에 스크롤을 멈출 수 있는가?
- 제목 클릭력 (25점): 제목만 보고 "이거 봐야 해"라고 느끼는가?
- 콘텐츠 밀도 (20점): 구간 내 정보/감정의 농도가 높은가?
- 서사 완결성 (15점): 시작-전개-결말이 자연스러운가?
- 반복 재생 유도 (10점): 한 번 더 보고 싶은 구조인가?

## 규칙
- 각 구간 길이: 15~30초
- 구간 간 최소 간격: 15초
- 주제 중복 금지
- 바이럴 점수가 높은 순으로 정렬
- 각 구간의 시작은 완전한 문장으로 시작해야 함
- 하이라이트라고 판단되는 좋은 구간은 모두 추출 (최소 3개, 최대 10개)

반드시 아래 JSON 배열만 반환하고, 다른 텍스트는 포함하지 마세요:
[
  {
    "start": "1:23",
    "end": "2:01",
    "title": "1줄(15자이내)\\n2줄(15자이내)",
    "subtitle": "부제목(20자이내)",
    "body": "본문 요약(40자이내)",
    "score": 85,
    "reason": "선정 이유"
  }
]`;

/**
 * Claude API로 하이라이트 구간 분석
 * @param {string} transcript - 타임스탬프 포함 자막 텍스트
 * @param {string} videoTitle - 영상 제목
 * @param {number} duration - 영상 길이 (초)
 * @returns {Promise<Array>} 하이라이트 구간 배열
 */
export async function analyzeHighlights(transcript, videoTitle, duration) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');

  const client = new Anthropic({ apiKey });

  const durationMin = Math.floor(duration / 60);
  const durationSec = Math.floor(duration % 60);

  const userContent = `## 영상 제목: ${videoTitle}
## 영상 길이: ${durationMin}분 ${durationSec}초 (${duration}초)

## 자막:
${transcript}`;

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
  });

  let responseText = message.content[0].text.trim();

  // ```json ... ``` 감싸기 대응
  if (responseText.startsWith('```')) {
    const lines = responseText.split('\n');
    const filtered = lines.filter(l => !l.startsWith('```'));
    responseText = filtered.join('\n');
  }

  let clips;
  try {
    clips = JSON.parse(responseText);
  } catch (e) {
    // JSON 배열 추출 시도
    const match = responseText.match(/\[[\s\S]*\]/);
    if (match) {
      clips = JSON.parse(match[0]);
    } else {
      throw new Error('Claude 응답에서 JSON을 파싱할 수 없습니다.');
    }
  }

  // score 순 내림차순 정렬
  clips.sort((a, b) => (b.score || 0) - (a.score || 0));

  // 시간 범위 검증
  clips = clips.filter(c => {
    const startSec = parseTimeStr(c.start);
    const endSec = parseTimeStr(c.end);
    return startSec >= 0 && endSec <= duration + 5 && endSec > startSec;
  });

  return clips;
}

/**
 * "1:23" 또는 "1:02:30" 형태의 시간 문자열을 초로 변환
 */
function parseTimeStr(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const parts = String(str).trim().split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}
