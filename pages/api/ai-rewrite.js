import Anthropic from '@anthropic-ai/sdk';

export const config = {
  api: { bodyParser: true },
  maxDuration: 30,
};

const TONE_INSTRUCTIONS = {
  hooking: '바이럴 크리에이터처럼 호기심을 유발. 단정형 말투 기본(~다, 명사 종결). ?!는 필요할 때만.',
  summary: '친근한 에디터처럼 깔끔하게 요약. 의문문/감탄사 금지. 기본 단정형, 일부만 ~요 체.',
};

const FIELD_INSTRUCTIONS = {
  title: {
    role: '시선을 멈추게 하는 헤드라인',
    format: '반드시 2줄(\\n 구분), 각 줄 12자 이내',
    rule: '호기심 유발, 해당 구간의 핵심 키워드 포함. 자막 내용 기반으로 작성.',
    example: '"에어팟 맥스 2\\n85만원의 진실"',
  },
  subtitle: {
    role: '제목의 맥락을 보충하는 다리 역할',
    format: '1줄, 20자 이내, 개행(\\n) 없이',
    rule: '제목이 "뭐?"라면 부제목은 "아, 그래서". 제목과 같은 말 반복 금지. 제목에서 부족한 맥락을 채워주는 한 줄.',
    example: '"전작 대비 뭐가 달라졌을까"',
  },
  body: {
    role: '해당 구간의 실제 핵심 내용 전달',
    format: '1~2줄, 40자 이내, 개행(\\n) 없이',
    rule: '자막에서 직접 추출한 구체적 팩트/요약. 숫자, 결과, 핵심 발언 포함. 제목·부제목과 같은 말 반복 금지.',
    example: '"노이즈캔슬링은 확실히 좋아졌는데 무게는 거의 그대로"',
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' });
    return;
  }

  const { transcript, tone, currentTitle, videoTitle, field } = req.body || {};

  if (!transcript || !tone || !videoTitle) {
    res.status(400).json({ error: 'transcript, tone, videoTitle 필드가 필요합니다.' });
    return;
  }

  const toneInstruction = TONE_INSTRUCTIONS[tone];
  if (!toneInstruction) {
    res.status(400).json({ error: `지원하지 않는 톤입니다. 가능한 값: ${Object.keys(TONE_INSTRUCTIONS).join(', ')}` });
    return;
  }

  const fieldKey = (field && FIELD_INSTRUCTIONS[field]) ? field : 'title';
  const fi = FIELD_INSTRUCTIONS[fieldKey];

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `당신은 카드뉴스 카피라이터입니다.

## 카드뉴스 구조
- 제목: 시선을 멈추게 하는 헤드라인 (2줄)
- 부제목: 제목의 맥락을 보충하는 다리 (1줄)
- 본문: 해당 구간의 실제 핵심 내용 (1~2줄)
- 세 필드가 같은 말을 반복하면 안 됨 — 각각 다른 레이어의 정보를 전달

## 톤
${toneInstruction}

항상 유효한 JSON 배열만 반환하고 다른 텍스트는 절대 포함하지 마세요.`;

    const userPrompt = `영상 제목: ${videoTitle}
구간 자막: ${transcript}
현재 값: ${currentTitle || '없음'}

## 요청: "${fi.role}" 역할의 [${fieldKey === 'title' ? '제목' : fieldKey === 'subtitle' ? '부제목' : '본문'}] 3개 제안

## 형식
${fi.format}

## 규칙
${fi.rule}

## 예시
${fi.example}

## 중요
- 자막 내용을 기반으로 작성 (자막에 없는 내용 지어내기 금지)
- 현재 값과 다른 방향으로 3개 제안
- JSON 문자열 배열로만 반환: ["제안1", "제안2", "제안3"]`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = message.content[0]?.text?.trim();
    if (!raw) {
      res.status(502).json({ error: 'Claude API에서 빈 응답을 반환했습니다.' });
      return;
    }

    let suggestions;
    try {
      const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\[[\s\S]*\])/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : raw;
      suggestions = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error('[ai-rewrite] JSON 파싱 실패:', raw);
      res.status(502).json({ error: 'AI 응답을 파싱할 수 없습니다.' });
      return;
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      res.status(502).json({ error: 'AI가 유효한 제안 목록을 반환하지 않았습니다.' });
      return;
    }

    // 부제목/본문은 개행 제거
    if (fieldKey !== 'title') {
      suggestions = suggestions.map(s => String(s).replace(/\n/g, ' ').trim());
    }

    res.status(200).json({ suggestions: suggestions.slice(0, 3) });
  } catch (err) {
    console.error('[ai-rewrite] 에러:', err);
    res.status(500).json({ error: `서버 오류: ${err.message?.slice(0, 200) || '알 수 없는 오류'}` });
  }
}
