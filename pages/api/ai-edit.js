import { getVideoInfo, extractSubtitles } from '../../lib/subtitle.js';
import { analyzeHighlights } from '../../lib/claude.js';

export const config = {
  api: { bodyParser: false },
};

function send(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const url = req.query.url;
  if (!url) {
    res.status(400).json({ error: 'url 파라미터가 필요합니다.' });
    return;
  }

  // SSE 헤더
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // 클라이언트 연결 해제 감지
  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    // 1. 영상 정보 조회
    send(res, 'status', { step: 'info', message: '영상 정보 확인 중...' });
    const videoInfo = await getVideoInfo(url);

    if (aborted) return res.end();

    // 2. 영상 길이 체크 (180분 = 10800초)
    if (videoInfo.duration > 10800) {
      send(res, 'error_event', {
        code: 'too_long',
        duration: videoInfo.duration,
        message: `영상이 ${Math.floor(videoInfo.duration / 60)}분입니다. 현재 180분 이하 영상만 지원합니다.`,
      });
      return res.end();
    }

    if (videoInfo.duration < 30) {
      send(res, 'error_event', {
        code: 'too_short',
        duration: videoInfo.duration,
        message: '영상이 너무 짧습니다. 30초 이상의 영상을 입력해주세요.',
      });
      return res.end();
    }

    send(res, 'status', {
      step: 'info',
      message: `"${videoInfo.title}" (${Math.floor(videoInfo.duration / 60)}분 ${Math.floor(videoInfo.duration % 60)}초)`,
    });

    if (aborted) return res.end();

    // 3. 자막 추출
    send(res, 'status', { step: 'subtitle', message: '자막 추출 중...' });
    const subtitleData = await extractSubtitles(url, videoInfo.videoId, (msg) => {
      if (!aborted) send(res, 'status', { step: 'subtitle', message: msg });
    });

    if (aborted) return res.end();

    if (!subtitleData || !subtitleData.segments.length) {
      send(res, 'error_event', {
        code: 'no_subtitle',
        message: '자막을 추출할 수 없습니다. 다른 영상을 시도해주세요.',
      });
      return res.end();
    }

    send(res, 'status', {
      step: 'subtitle',
      message: `자막 추출 완료 (${subtitleData.source === 'youtube_sub' ? 'YouTube 자막' : '음성 인식'}, ${subtitleData.segments.length}개 구간)`,
    });

    if (aborted) return res.end();

    // 4. Claude AI 분석
    send(res, 'status', { step: 'analyze', message: 'AI가 핵심 구간을 분석 중...' });
    const highlights = await analyzeHighlights(
      subtitleData.transcript,
      videoInfo.title,
      videoInfo.duration,
    );

    if (aborted) return res.end();

    if (!highlights || highlights.length === 0) {
      send(res, 'error_event', {
        code: 'no_highlights',
        message: '하이라이트 구간을 찾지 못했습니다. 다른 영상을 시도해주세요.',
      });
      return res.end();
    }

    // 5. 결과 전송
    send(res, 'result', {
      highlights,
      videoInfo: {
        title: videoInfo.title,
        duration: videoInfo.duration,
        videoId: videoInfo.videoId,
      },
      source: subtitleData.source,
    });

    res.end();
  } catch (err) {
    console.error('[ai-edit] 에러:', err);
    if (!aborted) {
      send(res, 'error_event', {
        code: 'server_error',
        message: `서버 오류: ${err.message?.slice(0, 200) || '알 수 없는 오류'}`,
      });
    }
    res.end();
  }
}
