import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT_BASE = `당신은 주어진 영상 트랜스크립션(타임스탬프 포함)을 분석하여,
카드뉴스에 적합한 핵심 하이라이트 구간을 추출하는 전문가입니다.

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

## 규칙
- 각 구간 길이: 15~30초
- 구간 간 최소 간격: 15초
- 주제 중복 금지
- 각 구간의 시작은 완전한 문장으로 시작해야 함
- 하이라이트라고 판단되는 좋은 구간은 모두 추출 (최소 3개, 최대 10개)

## 카드 구성
- 바이럴 점수가 높은 순으로 정렬
- 제목만 표시되므로 제목이 곧 카드의 전부 — 강렬하고 호기심을 유발해야 함

## 첫 번째 카드 = 커버 카드 (매우 중요)
- 첫 번째 카드는 전체 카드뉴스의 **대표 표지** 역할
- 구간: 바이럴 점수가 가장 높은 구간 (가장 임팩트 있는 장면)
- 제목 작성법: 영상 원본 제목에서 **핵심 키워드**를 반드시 포함하여 커버 카피로 재가공
  - 영상 제목의 주요 대상(제품명, 인물명, 주제어)을 살려야 함
  - 단순 복사가 아니라, 톤에 맞게 카피라이팅하여 재구성
  - 이 카드 하나만 봐도 "이 콘텐츠가 뭔지" 즉시 알 수 있어야 함
- 예: 영상 제목이 "에어팟 맥스 2 솔직 리뷰"라면
  - 후킹형: "에어팟 맥스 2\n이게 85만원이라고?"
  - 요약형: "에어팟 맥스 2\n핵심 변화 3가지"

반드시 아래 JSON 배열만 반환하고, 다른 텍스트는 포함하지 마세요.
첫 번째 요소가 커버 카드입니다:
[
  {
    "start": "1:23",
    "end": "2:01",
    "title": "영상 키워드 포함 커버 제목\\n2줄(15자이내)",
    "is_cover": true,
    "score": 95,
    "reason": "커버 카드 - 영상 제목 키워드 활용"
  },
  {
    "start": "3:45",
    "end": "4:12",
    "title": "1줄(15자이내)\\n2줄(15자이내)",
    "score": 85,
    "reason": "선정 이유"
  }
]`;

const TONE_PROMPTS = {
  hooking: `## 페르소나
당신은 구독자 100만 이상의 한국 탑 유튜브 쇼츠 크리에이터이자 바이럴 심리학 전문가입니다.

## 핵심 원칙
- 제목은 반드시 해당 구간의 자막 내용에서 핵심 키워드와 맥락을 추출하여 작성
- 자막에 없는 내용을 지어내거나, 실제 내용과 다른 부정적/자극적 프레이밍 금지
- 긍정적인 내용이면 긍정적으로, 중립적이면 중립적으로 — 내용의 톤을 존중
- 후킹은 "내용을 왜곡"하는 게 아니라 "핵심을 매력적으로 포장"하는 것

## 제목 작성 규칙
- 반드시 2줄로 작성 (\\n으로 구분)
- 1줄: 해당 구간의 핵심 주제/상황 — 12자 이내
- 2줄: 핵심 정보를 호기심 유발하게 표현 — 12자 이내
- 단정형 말투 기본 (~다, ~했다, 명사 종결)
- 호기심 갭 활용하되 자막 내용 기반으로

## ?! 사용
- ?나 !는 의무가 아님 — 맥락상 필요할 때만 자연스럽게 사용
- 매 카드마다 ?!를 남발하면 피로감 유발
- "?!" 조합도 꼭 필요한 경우에만

## 전체 흐름 규칙
- 카드를 1번부터 순서대로 읽었을 때 하나의 이야기처럼 자연스러워야 함
- 첫 카드에서 강하게, 중간은 서술, 마지막에 임팩트 — 하지만 이것도 절대 규칙은 아님

## 유연성
- 위 규칙들은 가이드라인이지 절대 법칙이 아닙니다
- 상황과 맥락에 따라, 목적에 맞게 일부 규칙은 자연스럽게 어길 수 있습니다
- 가장 중요한 건 전체 카드를 이어 읽었을 때 뉘앙스가 이상하지 않은 것입니다

## 바이럴 점수 산정 (100점 만점)
- 후킹 파괴력 (25점): 첫 카드가 스크롤을 멈출 수 있는가?
- 제목 클릭력 (20점): 제목만 보고 궁금해지는가?
- 콘텐츠 밀도 (20점): 구간 내 정보/감정의 농도가 높은가?
- 서사 완결성 (20점): 카드 전체를 이어 읽었을 때 자연스러운가?
- 반복 재생 유도 (15점): 한 번 더 보고 싶은 구조인가?

## 예시
- "이 가격에 이 성능\\n업계가 뒤집혔다"
- "의사가 절대 안 먹는 음식\\n당장 버려야 할 것들"
- "삼성이 숨겨온 기능\\n아무도 몰랐다"`,

  summary: `## 페르소나
당신은 친근한 IT/라이프스타일 에디터입니다.
핵심 정보를 깔끔하게 전달하되, 약간의 마케팅 후킹을 더합니다.

## 제목 작성 규칙
- 반드시 2줄로 작성 (\\n으로 구분)
- 1줄: 주제/대상 — 12자 이내
- 2줄: 핵심 내용 요약 — 12자 이내
- 간결하고 명확하게, 과장 없이 작성

## 말투 규칙
- 기본은 단정형 (명사 종결, ~다, ~한다)
- 전체 카드 중 2~3장 정도만 부드러운 문장형 (~요, ~해요, ~이래요)을 자연스럽게 섞기
- 모든 카드가 ~요로 끝나면 안 됨 — 변화를 줘야 함
- 순서대로 읽었을 때 톤이 자연스럽게 이어져야 함

## 금지어
- "?!" 조합, "충격", "경악", "미쳤다", "역대급", "ㄷㄷ"
- 의문문 (물음표로 끝나는 문장)
- 강한 감탄사 ("헐", "대박", "와...")

## 전체 흐름 규칙
- 카드를 1번부터 순서대로 읽었을 때 하나의 콘텐츠처럼 자연스러워야 함
- 같은 문장 구조가 연속으로 반복되면 안 됨

## 유연성
- 위 규칙들은 가이드라인이지 절대 법칙이 아닙니다
- 상황과 맥락에 따라, 목적에 맞게 일부 규칙은 자연스럽게 어길 수 있습니다
- 가장 중요한 건 전체 카드를 이어 읽었을 때 뉘앙스가 이상하지 않은 것입니다

## 바이럴 점수 산정 (100점 만점)
- 정보 전달력 (35점): 핵심 내용이 명확히 전달되는가?
- 제목 명확성 (25점): 무슨 내용인지 바로 알 수 있는가?
- 서사 완결성 (25점): 전체 카드를 이어 읽었을 때 자연스러운가?
- 콘텐츠 밀도 (15점): 구간 내 정보의 농도가 높은가?

## 예시
- "에어팟 맥스 2\\n달라진 점 세 가지"
- "배터리 성능\\n꽤 많이 좋아졌어요"
- "디자인 변화\\n거의 그대로다"`,
};

/**
 * Claude API로 하이라이트 구간 분석
 * @param {string} transcript - 타임스탬프 포함 자막 텍스트
 * @param {string} videoTitle - 영상 제목
 * @param {number} duration - 영상 길이 (초)
 * @param {string} tone - 카피 톤 ('hooking' | 'summary' | 'factual')
 * @returns {Promise<Array>} 하이라이트 구간 배열
 */
export async function analyzeHighlights(transcript, videoTitle, duration, tone = 'hooking') {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');

  const client = new Anthropic({ apiKey });

  const validTone = TONE_PROMPTS[tone] ? tone : 'hooking';
  const systemPrompt = SYSTEM_PROMPT_BASE + '\n\n' + TONE_PROMPTS[validTone];

  const durationMin = Math.floor(duration / 60);
  const durationSec = Math.floor(duration % 60);

  const userContent = `## 영상 제목: ${videoTitle}
## 영상 길이: ${durationMin}분 ${durationSec}초 (${duration}초)

## 자막:
${transcript}`;

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
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

  // 커버 카드 우선, 나머지는 score 내림차순 정렬
  clips.sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1;
    if (!a.is_cover && b.is_cover) return 1;
    return (b.score || 0) - (a.score || 0);
  });

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

/* ═══════════════════════════════════════════════════════════
   아티클 → 카드뉴스 분할 (텍스트로 만들기 기능)
   ═══════════════════════════════════════════════════════════ */

const ARTICLE_STYLE_PRESETS = {
  stock_photo: {
    label: '스톡 포토',
    stylePrefix: 'Professional commercial stock photograph, crisp sharp focus, high resolution, bright balanced natural lighting, soft diffused shadows, clean modern minimalist setting, generous negative space around subject, neutral polished color grading with natural skin tones, premium editorial photography aesthetic, approachable friendly mood, centered composition, pristine commercial photography quality, no watermarks, no logos, no brand text, clean image',
  },
  cinematic_photo: {
    label: '시네마틱 포토',
    stylePrefix: 'Cinematic photograph with warm Portra-style color grading, 85mm lens at f/2.0, shallow depth of field with natural bokeh, soft natural window light, warm balanced earth tones with gentle highlight roll-off, subtle fine grain texture, considered composition and narrative framing, editorial magazine aesthetic, atmospheric mood, single subject, minimal clean background, full-frame edge-to-edge digital composition, no film borders, no sprocket holes, no film strip, no camera UI, clean image',
  },
  char_3d: {
    label: '3D 캐릭터',
    stylePrefix: 'Stylized 3D character illustration, full-body visible pose, Pixar-inspired, soft clay-like materials, rounded shapes, warm pastel colors, ambient occlusion, studio lighting, cute and approachable, single subject, minimal clean background',
  },
  minimal_graphic: {
    label: '미니멀 그래픽',
    stylePrefix: 'Minimalist geometric illustration, limited 3-color palette, clean vector shapes, lots of whitespace, Bauhaus inspired, bold simple composition, flat design',
  },
};

export function getArticleStylePreset(id) {
  return ARTICLE_STYLE_PRESETS[id] || ARTICLE_STYLE_PRESETS.stock_photo;
}

export function listArticleStylePresets() {
  return Object.entries(ARTICLE_STYLE_PRESETS).map(([id, v]) => ({ id, label: v.label }));
}

const ARTICLE_DIVIDE_SYSTEM = `당신은 웹 아티클을 카드뉴스로 재구성하는 한국 콘텐츠 에디터입니다.
원본 기사를 읽고, 5~12장의 카드뉴스로 분할합니다.

## 핵심 원칙
- 원문 내용에 충실할 것. 없는 사실을 지어내지 말 것.
- 각 카드는 하나의 단일 메시지에 집중 (1 card = 1 idea)
- 첫 번째 카드는 반드시 커버(cover) — 기사 전체를 압축하는 후킹
- 마지막 카드는 요약/액션/출처 안내 (outro)
- 중간 카드들(content)은 기사의 서사 흐름을 따라가되, 카드 간 논리적 연결 유지

## 카드 타입별 문구 구조 (매우 중요)

### cover (첫 번째 카드 1장만)
- 큰 제목(headline) + 부제(subtext) 중심. body는 빈 문자열.
- headline: 2줄 가능, 각 줄 12자 이내
- subtext: 25~40자, 기사 전체 요약
- 예: { "type": "cover", "headline": "낮에 짜고\\n밤에 푼 20년", "subtext": "오디세우스를 기다린 페넬로페의 지혜로운 저항", "body": "" }

### content (나머지 카드 전부)
- **본문(body)이 주인공**. subtext는 항상 빈 문자열.
- body: 2~4문장 또는 1~2줄의 핵심 문장. 기사 원문의 구체적 내용(사건·인물·수치·인용)을 담음.
- body 글자수: 60~130자 권장, 최대 180자.
- 카드 간 흐름: 기·승·전·결을 따라가며 자연스럽게 이어짐.
- **마지막 카드**도 마무리·요약·액션·출처 안내를 body에 담음.

#### content의 headline(소제목)은 선택적 — 기사 구조에 따라 판단
기사가 **리스트/섹션형** (목록, 단계별, 유형별 나열 구조)일 때는 각 content 카드에 **짧은 소제목**(headline)을 붙인다.
- 예: "유형 1: 지원금 사칭", "단계 1: 재료 준비", "방법 3: 답글 빠르게"
- headline: 18자 이내, 한 줄 권장

기사가 **서사/흐름형** (이야기처럼 자연스럽게 이어지는 문장)일 때는 headline을 **빈 문자열**로 둔다.
- 여러 카드가 한 흐름으로 읽히는 경우, 소제목을 강제로 넣으면 흐름 끊김

판단 기준:
- 원문에 "1) 2) 3)" 같은 번호 매기기, "첫째, 둘째", "단계", "유형", "종류" 같은 구조 키워드 → 리스트형 → headline 있음
- 원문이 시간·인과 순서대로 이어지는 이야기 → 서사형 → headline 없음
- 판단이 애매하면 기본은 headline 없음 (body만)

### 예시

**리스트형 (headline 있음)**
{ "type": "content", "headline": "유형 1: 지원금 사칭", "subtext": "", "body": "정부 기관을 사칭해 '소상공인 지원금을 신청하세요'라는 문자로 접근한다. 링크 클릭 시 개인정보 유출 위험이 크다." }

**서사형 (headline 없음)**
{ "type": "content", "headline": "", "subtext": "", "body": "페넬로페는 시아버지의 수의를 짠다는 핑계로 구혼자들의 청혼을 20년간 미뤘다. 낮에는 천을 짜고, 밤에는 몰래 풀어버리기를 반복하며." }

### outro 타입은 쓰지 않습니다
모든 카드는 cover(첫 카드) 아니면 content(나머지) 두 타입만 사용.

## 이미지 전략 (imageStrategy)
원본 기사에서 추출된 이미지 목록을 함께 받습니다.
각 카드마다 셋 중 하나를 선택:
- "reuse": 원본 기사 이미지를 그대로 사용 (가장 우선). sourceImageIndex 필수.
- "generate": AI가 새로 생성. imagePrompt 필수.
- "none": 이미지 없이 텍스트만

원본 이미지가 해당 카드 내용과 맞지 않거나 부족할 때만 generate. 최대한 reuse 우선.

## 이미지 프롬프트 작성 규칙 (imagePrompt)
- 영어로 작성 (Flux가 영어 프롬프트에 더 정확)
- 사람 얼굴/실존 인물/유명인/브랜드 로고 금지 (손·실루엣·뒷모습·추상화로 대체)
- "no text, no letters, no typography" 항상 포함 (한글 렌더링 회피)
- 구체적 장면 묘사: 장소, 사물, 분위기, 조명
- 스타일 설명은 system 쪽에서 자동 주입되므로 프롬프트에는 넣지 않음
- 예시: "hands holding a smartphone showing a delivery order notification, cafe counter, warm morning light, no text"

## JSON 출력 스키마
반드시 아래 형태의 JSON만 반환하고, 다른 텍스트나 코드블록 마커 없이.
type은 "cover" (첫 카드 1장) 또는 "content" (나머지 전부) 둘 중 하나만 사용:
{
  "title": "카드뉴스 전체 제목 (기사 제목 기반, 25자 이내)",
  "cards": [
    {
      "type": "cover",
      "headline": "표지 문구\\n2줄 가능",
      "subtext": "부제 (25~40자)",
      "body": "",
      "imageStrategy": "reuse",
      "sourceImageIndex": 0
    },
    {
      "type": "content",
      "headline": "",
      "subtext": "",
      "body": "본문 내용 2~4문장. 기사의 핵심 사건·인용·숫자를 담아 서사가 이어지도록 쓴다.",
      "imageStrategy": "generate",
      "imagePrompt": "hands taking notes in notebook, warm lighting, flat style, no text"
    },
    {
      "type": "content",
      "headline": "",
      "subtext": "",
      "body": "마지막 카드도 body 중심. 마무리·요약·액션·출처 안내를 담는다.",
      "imageStrategy": "reuse",
      "sourceImageIndex": 1
    }
  ]
}
`;

const ARTICLE_TONE_GUIDE = {
  hooking: '후킹형: 호기심 유발, 충격·반전·비밀 암시. 매 카드가 다음을 궁금하게 만들어야 함.',
  summary: '정보형: 핵심만 간결하게. 담백하고 신뢰감 있는 톤. 과장 금지.',
  emotional: '감성형: 공감·위로·응원. 부드러운 어투 섞어도 OK. 따뜻한 인상.',
};

/**
 * 아티클 본문을 카드뉴스 구조로 분할
 * @param {object} article - { title, body, images, blocks, thumbnail, sourceUrl }
 * @param {object} options
 * @param {number|'auto'} [options.cardCount='auto']
 * @param {string} [options.tone='hooking']
 * @param {string} [options.presetId='warm_illust']
 * @param {string} [options.imageMode='reuse'] - 'reuse' | 'generate'
 * @returns {Promise<{ title: string, cards: Array }>}
 */
export async function divideArticleToCards(article, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY가 설정되지 않았습니다.');

  const client = new Anthropic({ apiKey });
  const tone = ARTICLE_TONE_GUIDE[options.tone] ? options.tone : 'hooking';
  const imageMode = options.imageMode === 'generate' ? 'generate' : 'reuse';
  const availableImages = Array.isArray(article.images) ? article.images.length : 0;

  // cardCount hint
  let cardCountHint;
  if (options.cardCount === 'auto' || !options.cardCount) {
    cardCountHint = '본문 길이에 맞춰 자동 결정 (5~12장 권장)';
  } else {
    cardCountHint = `정확히 ${Number(options.cardCount)}장`;
  }

  // 모드별 시스템 프롬프트 부록
  const modeInstruction = imageMode === 'reuse'
    ? `## 이미지 모드: 본문 이미지 우선 + 부족분 AI 생성 (REUSE PRIORITY)
- 원본 기사 이미지 ${availableImages}장 사용 가능.
- 카드 수가 이미지 수 이하면: 모든 카드를 "reuse"로 지정 (sourceImageIndex 0..${Math.max(0, availableImages - 1)}, 고유 값).
- 카드 수가 이미지 수를 초과하면:
  1) 원본 이미지와 의미적으로 가장 잘 맞는 카드 ${availableImages}장을 "reuse"로 지정 (sourceImageIndex 고유, 중복 금지).
  2) 남은 카드는 "generate"로 지정하고 imagePrompt(영문) 작성.
- reuse는 가급적 cover 포함 앞쪽 핵심 카드에 우선 배정 (중요한 시각 콘텐츠가 먼저 보이도록).
- 각 sourceImageIndex는 0 이상 ${Math.max(0, availableImages - 1)} 이하, **유일한 값**이어야 함. 같은 이미지 두 카드에 쓰지 말 것.
- "none"은 사용 금지.
${availableImages === 0 ? '- 원본 이미지가 없으므로 모든 카드를 "generate"로 해야 합니다.' : ''}`
    : `## 이미지 모드: GENERATE 전용
- 모든 카드의 imageStrategy는 반드시 "generate"여야 합니다. "reuse"와 "none" 사용 금지.
- 원본 이미지는 전혀 사용하지 않습니다.
- 각 카드마다 imagePrompt를 반드시 작성 (영문, 스타일은 시스템이 주입).
- sourceImageIndex는 null.`;

  const systemPrompt = ARTICLE_DIVIDE_SYSTEM + `\n\n${modeInstruction}\n\n## 이번 작업\n- 카드 수: ${cardCountHint}\n- 톤: ${ARTICLE_TONE_GUIDE[tone]}\n`;

  const imagesList = (article.images || []).map((src, i) => `[${i}] ${src}`).join('\n') || '(원본 이미지 없음)';

  const userContent = `## 기사 제목
${article.title || '(제목 없음)'}

## 출처
${article.sourceUrl || '(출처 없음)'}

## 원본 이미지 목록 (reuse 시 sourceImageIndex로 참조)
${imagesList}

## 본문
${article.body || ''}

---
위 기사를 카드뉴스로 분할해주세요. JSON만 반환.`;

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }],
  });

  let responseText = message.content[0].text.trim();
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (e) {
    const match = responseText.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]);
    else throw new Error('Claude 응답에서 JSON을 파싱할 수 없습니다.');
  }

  if (!parsed || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
    throw new Error('Claude 응답에 cards 배열이 없습니다.');
  }

  // 검증·정규화
  // 규칙: 첫 카드만 cover, 나머지는 무조건 content로 강제 (outro/기타 type 제거)
  parsed.cards = parsed.cards.map((c, i) => ({
    index: i,
    type: i === 0 ? 'cover' : 'content',
    headline: (c.headline || '').slice(0, 60),
    subtext: (c.subtext || '').slice(0, 100),
    body: (c.body || '').slice(0, 240),
    imageStrategy: ['reuse', 'generate', 'none'].includes(c.imageStrategy) ? c.imageStrategy : 'generate',
    imagePrompt: c.imagePrompt || '',
    sourceImageIndex: typeof c.sourceImageIndex === 'number' ? c.sourceImageIndex : null,
  }));

  // 모드별 강제 정규화 (Claude가 지시를 어기더라도 안전망)
  if (imageMode === 'reuse') {
    // REUSE PRIORITY: 이미지 수까지는 reuse, 초과분은 generate로 자동 전환
    if (availableImages === 0) {
      // 이미지 0장 → 전부 generate
      parsed.cards.forEach(c => {
        c.imageStrategy = 'generate';
        c.sourceImageIndex = null;
        if (!c.imagePrompt) {
          const hint = (c.body || c.headline || c.subtext || '').slice(0, 80);
          c.imagePrompt = `abstract editorial illustration evoking: ${hint}, no text, no letters`;
        }
      });
    } else {
      // Claude가 할당한 reuse/generate 결정을 최대한 유지하되
      // sourceImageIndex 중복/범위 검증 + 부족분 자동 전환
      const usedIndices = new Set();
      parsed.cards.forEach(c => {
        if (c.imageStrategy === 'reuse') {
          const idx = c.sourceImageIndex;
          if (typeof idx === 'number' && idx >= 0 && idx < availableImages && !usedIndices.has(idx)) {
            // 유효한 reuse
            usedIndices.add(idx);
            c.imagePrompt = '';
          } else {
            // 중복 또는 범위 밖 → 사용 가능한 다른 인덱스로 재배정
            let reassigned = false;
            for (let j = 0; j < availableImages; j++) {
              if (!usedIndices.has(j)) {
                c.sourceImageIndex = j;
                usedIndices.add(j);
                reassigned = true;
                c.imagePrompt = '';
                break;
              }
            }
            if (!reassigned) {
              // 이미지 모두 소진 → generate로 강등
              c.imageStrategy = 'generate';
              c.sourceImageIndex = null;
              if (!c.imagePrompt) {
                const hint = (c.body || c.headline || c.subtext || '').slice(0, 80);
                c.imagePrompt = `abstract editorial illustration evoking: ${hint}, no text, no letters`;
              }
            }
          }
        } else {
          // Claude가 generate로 지정 → 유지, imagePrompt 보강
          c.imageStrategy = 'generate';
          c.sourceImageIndex = null;
          if (!c.imagePrompt) {
            const hint = (c.body || c.headline || c.subtext || '').slice(0, 80);
            c.imagePrompt = `abstract editorial illustration evoking: ${hint}, no text, no letters`;
          }
        }
      });
    }
  } else {
    // GENERATE 전용 모드: 모든 카드를 generate로 강제
    parsed.cards.forEach(c => {
      c.imageStrategy = 'generate';
      c.sourceImageIndex = null;
      if (!c.imagePrompt) {
        const hint = (c.body || c.headline || c.subtext || 'editorial scene').slice(0, 80);
        c.imagePrompt = `abstract editorial illustration evoking: ${hint}, no text, no letters`;
      }
    });
  }

  return {
    title: parsed.title || article.title || '',
    cards: parsed.cards,
    presetId: options.presetId || 'warm_illust',
    tone,
    imageMode,
  };
}
