import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { ensureCookieFile } from './worker.js';

const execFileAsync = promisify(execFile);

const COOKIE_PATH = '/tmp/yt-cookies.txt';
const TEMP_DIR = process.env.STORAGE_DIR
  ? path.join(process.env.STORAGE_DIR, 'temp')
  : '/tmp/yt2c-storage/temp';

/**
 * yt-dlp로 YouTube 영상 메타데이터(duration 등) 조회
 */
export async function getVideoInfo(url) {
  ensureCookieFile();
  const args = ['--dump-json', '--no-download', '--no-playlist', url];
  if (fs.existsSync(COOKIE_PATH)) args.unshift('--cookies', COOKIE_PATH);

  const { stdout } = await execFileAsync('yt-dlp', args, { timeout: 30000 });
  const info = JSON.parse(stdout);
  return {
    duration: info.duration || 0,
    title: info.title || '',
    videoId: info.id || '',
    hasSubtitles: !!(info.subtitles && Object.keys(info.subtitles).length > 0),
    hasAutoSub: !!(info.automatic_captions && Object.keys(info.automatic_captions).length > 0),
  };
}

/**
 * yt-dlp로 YouTube 자체자막 추출 (json3 포맷)
 * 한국어 우선 → 영어 폴백
 */
async function fetchYouTubeSubtitles(url, videoId) {
  ensureCookieFile();
  const outTemplate = path.join(TEMP_DIR, `sub_${videoId}`);
  const args = [
    '--write-sub', '--write-auto-sub',
    '--sub-lang', 'ko,en',
    '--sub-format', 'json3',
    '--skip-download',
    '--no-playlist',
    '-o', outTemplate,
    url,
  ];
  if (fs.existsSync(COOKIE_PATH)) args.unshift('--cookies', COOKIE_PATH);

  try {
    await execFileAsync('yt-dlp', args, { timeout: 60000 });
  } catch (e) {
    console.warn('[subtitle] yt-dlp 자막 추출 실패:', e.message?.slice(0, 200));
    return null;
  }

  // json3 파일 찾기 (ko 우선, en 폴백)
  const dir = path.dirname(outTemplate);
  const base = path.basename(outTemplate);
  const candidates = [];
  try {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      if (f.startsWith(base) && f.endsWith('.json3')) {
        candidates.push(path.join(dir, f));
      }
    }
  } catch { return null; }

  if (candidates.length === 0) return null;

  // 한국어 우선
  const koFile = candidates.find(f => f.includes('.ko.'));
  const picked = koFile || candidates[0];
  const lang = koFile ? 'ko' : 'en';

  try {
    const raw = JSON.parse(fs.readFileSync(picked, 'utf-8'));
    const segments = parseJson3(raw);

    // 임시 파일 정리
    for (const f of candidates) {
      try { fs.unlinkSync(f); } catch {}
    }

    return { segments, language: lang, source: 'youtube_sub' };
  } catch (e) {
    console.warn('[subtitle] json3 파싱 실패:', e.message);
    return null;
  }
}

/**
 * YouTube json3 자막 포맷 파싱
 */
function parseJson3(data) {
  const events = data.events || [];
  const segments = [];

  for (const ev of events) {
    if (!ev.segs || ev.tStartMs == null) continue;
    const text = ev.segs.map(s => s.utf8 || '').join('').trim();
    if (!text || text === '\n') continue;

    const start = ev.tStartMs / 1000;
    const end = ev.dDurationMs ? (ev.tStartMs + ev.dDurationMs) / 1000 : start + 3;
    segments.push({ text, start: Math.round(start * 1000) / 1000, end: Math.round(end * 1000) / 1000 });
  }

  return segments;
}

/**
 * OpenAI Whisper API로 STT (자막 없는 영상용 폴백)
 */
async function whisperSTT(url, videoId, onStatus) {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY가 설정되지 않았습니다.');

  ensureCookieFile();

  // 1. 오디오 추출
  onStatus?.('오디오 추출 중...');
  const audioPath = path.join(TEMP_DIR, `audio_${videoId}.mp3`);
  const ytArgs = [
    '-x', '--audio-format', 'mp3',
    '--audio-quality', '5',
    '--no-playlist',
    '-o', audioPath,
    url,
  ];
  if (fs.existsSync(COOKIE_PATH)) ytArgs.unshift('--cookies', COOKIE_PATH);

  await execFileAsync('yt-dlp', ytArgs, { timeout: 300000 });

  try {
    const fileSize = fs.statSync(audioPath).size;
    const MAX_CHUNK_SIZE = 24 * 1024 * 1024; // 24MB

    // 2. 청크 분할 (필요 시)
    const chunks = [];
    if (fileSize <= MAX_CHUNK_SIZE) {
      chunks.push({ path: audioPath, offset: 0 });
    } else {
      onStatus?.('오디오 분할 중...');
      const totalDuration = await getAudioDuration(audioPath);
      const numChunks = Math.ceil(fileSize / MAX_CHUNK_SIZE);
      const chunkDur = totalDuration / numChunks;

      for (let i = 0; i < numChunks; i++) {
        const chunkPath = path.join(TEMP_DIR, `audio_${videoId}_chunk${i}.mp3`);
        await execFileAsync('ffmpeg', [
          '-y', '-ss', String(i * chunkDur),
          '-i', audioPath,
          '-t', String(chunkDur),
          '-acodec', 'libmp3lame', '-ar', '16000', '-ac', '1', '-b:a', '64k',
          chunkPath,
        ], { timeout: 120000 });
        chunks.push({ path: chunkPath, offset: i * chunkDur });
      }
    }

    // 3. Whisper API 호출
    const allWords = [];
    for (let i = 0; i < chunks.length; i++) {
      onStatus?.(`음성 인식 중... (${i + 1}/${chunks.length})`);
      const chunk = chunks[i];
      const formData = new FormData();
      const audioBuffer = fs.readFileSync(chunk.path);
      formData.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'audio.mp3');
      formData.append('model', 'whisper-1');
      formData.append('language', 'ko');
      formData.append('response_format', 'verbose_json');
      formData.append('timestamp_granularities[]', 'segment');

      const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
        body: formData,
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Whisper API 오류 (${resp.status}): ${errText.slice(0, 200)}`);
      }

      const data = await resp.json();
      const segments = data.segments || [];
      for (const seg of segments) {
        allWords.push({
          text: seg.text?.trim() || '',
          start: Math.round((seg.start + chunk.offset) * 1000) / 1000,
          end: Math.round((seg.end + chunk.offset) * 1000) / 1000,
        });
      }
    }

    // 4. 정렬
    allWords.sort((a, b) => a.start - b.start);

    return { segments: allWords, language: 'ko', source: 'whisper' };
  } finally {
    // 임시 파일 정리
    const dir = TEMP_DIR;
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.startsWith(`audio_${videoId}`)) {
          try { fs.unlinkSync(path.join(dir, f)); } catch {}
        }
      }
    } catch {}
  }
}

/**
 * ffprobe로 오디오 길이 조회
 */
async function getAudioDuration(audioPath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    audioPath,
  ], { timeout: 10000 });
  return parseFloat(stdout.trim()) || 0;
}

/**
 * 세그먼트 배열을 Claude에 보낼 타임스탬프 포함 텍스트로 변환
 */
export function segmentsToTranscript(segments) {
  return segments.map(s => {
    const mm = Math.floor(s.start / 60);
    const ss = Math.floor(s.start % 60);
    const ts = `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    return `[${ts}] ${s.text}`;
  }).join('\n');
}

/**
 * 메인 자막 추출 함수
 * YouTube 자체자막 → Whisper STT 폴백
 */
export async function extractSubtitles(url, videoId, onStatus) {
  // 1차: YouTube 자체자막
  onStatus?.('YouTube 자막 확인 중...');
  const ytSub = await fetchYouTubeSubtitles(url, videoId);
  if (ytSub && ytSub.segments.length > 0) {
    onStatus?.(`YouTube 자막 발견 (${ytSub.language})`);
    return {
      ...ytSub,
      transcript: segmentsToTranscript(ytSub.segments),
    };
  }

  // 2차: Whisper STT
  onStatus?.('자막 없음 - 음성 인식으로 전환...');
  const whisperResult = await whisperSTT(url, videoId, onStatus);
  return {
    ...whisperResult,
    transcript: segmentsToTranscript(whisperResult.segments),
  };
}
