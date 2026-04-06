import Anthropic from '@anthropic-ai/sdk';

export const config = {
  api: { bodyParser: true },
  maxDuration: 30,
};

const TONE_INSTRUCTIONS = {
  hooking: '바이럴 크리에이터처럼 호기심을 유발하는 제목. 단정형 말투 기본(~다, 명사 종결). ?!는 3개 중 최대 1개에서만 사용. 각 줄 12자 이내. 예: "이 가격에 이 성능\\n업계가 뒤집혔다"',
  summary: '친근한 에디터처럼 내용을 깔끔하게 요약. 의문문/감탄사 금지. 기본은 단정형이되, 3개 중 1개 정도만 부드러운 문장형(~요, ~해요)을 섞기. 나머지는 명사 종결이나 ~다 체. 각 줄 12자 이내. 예: "에어팟 맥스 2\\n달라진 점 세 가지", "배터리 성능\\n꽤 많이 좋아졌어요"',
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

  const { transcript, tone, currentTitle, videoTitle } = req.body || {};

  if (!transcript || !tone || !currentTitle || !videoTitle) {
    res.status(400).json({ error: 'transcript, tone, currentTitle, videoTitle 필드가 모두 필요합니다.' });
    return;
  }

  const toneInstruction = TONE_INSTRUCTIONS[tone];
  if (!toneInstruction) {
    res.status(400).json({ error: `지원하지 않는 톤입니다. 가능한 값: ${Object.keys(TONE_INSTRUCTIONS).join(', ')}` });
    return;
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: `당신은 카드뉴스 카피라이터입니다. 항상 유효한 JSON 배열만 반환하고 다른 텍스트는 절대 포함하지 마세요.`,
      messages: [
        {
          role: 'user',
          content: `영상 제목: ${videoTitle}\n구간 자막: ${transcript}\n현재 제목: ${currentTitle}\n\n위 구간에 대해 ${toneInstruction}으로 대안 제목 3개를 JSON 배열로 반환해주세요. 각 제목은 2줄(\\n 구분), 각 줄 15자 이내. 현재 제목과 다른 방향으로.`,
        },
      ],
    });

    const raw = message.content[0]?.text?.trim();
    if (!raw) {
      res.status(502).json({ error: 'Claude API에서 빈 응답을 반환했습니다.' });
      return;
    }

    let suggestions;
    try {
      // JSON 블록 추출 (```json ... ``` 또는 순수 배열)
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

    res.status(200).json({ suggestions: suggestions.slice(0, 3) });
  } catch (err) {
    console.error('[ai-rewrite] 에러:', err);
    res.status(500).json({ error: `서버 오류: ${err.message?.slice(0, 200) || '알 수 없는 오류'}` });
  }
}
