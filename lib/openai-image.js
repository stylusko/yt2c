// OpenAI gpt-image-2 (ChatGPT Images 2.0) 이미지 생성 래퍼
// - low 품질 고정 (1024×1024 기준 약 $0.006/장)
// - 한글/멀티언어 프롬프트 이해 가능 (Flux 대체 동기)
// - b64_json → data URL 변환 후 반환 (현재 버킷 미설정 상태 대응)
// - 재시도 + 에러 분류 + 병렬 생성

import OpenAI from 'openai';

const MODEL = 'gpt-image-2';
const QUALITY = 'low';
const DEFAULT_TIMEOUT_MS = 120000; // gpt-image-2는 reasoning 포함이라 좀 더 김
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

// gpt-image-2 지원 해상도: 1024x1024 / 1024x1536(세로) / 1536x1024(가로)
// 4:5, 9:16, 16:9 같은 비표준 비율은 가장 가까운 표준으로 매핑.
const ASPECT_TO_SIZE = {
  '1:1':  '1024x1024',
  '4:5':  '1024x1536',
  '9:16': '1024x1536',
  '3:4':  '1024x1536',
  '2:3':  '1024x1536',
  '4:3':  '1536x1024',
  '3:2':  '1536x1024',
  '16:9': '1536x1024',
};

function resolveSize(aspectRatio) {
  return ASPECT_TO_SIZE[aspectRatio] || '1024x1024';
}

function sizeToDimensions(size) {
  const [w, h] = size.split('x').map(Number);
  return { width: w, height: h };
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

class OpenAIImageError extends Error {
  constructor(message, { code, status, retriable, cause } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.retriable = retriable;
    this.cause = cause;
  }
}

let _client = null;
function getClient() {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIImageError('OPENAI_API_KEY가 설정되지 않았습니다.', { code: 'NO_API_KEY' });
  _client = new OpenAI({ apiKey, timeout: DEFAULT_TIMEOUT_MS });
  return _client;
}

/**
 * gpt-image-2로 이미지 1장 생성.
 * @param {object} params
 * @param {string} params.prompt
 * @param {string} [params.aspectRatio] - '1:1' | '3:4' | '4:3' | ...
 * @returns {Promise<{ url: string, width: number, height: number, seed: null, contentType: string }>}
 *   url: `data:image/png;base64,...` 형식 (버킷 영속화 미사용)
 *   seed: gpt-image-2는 seed 미지원이라 항상 null
 */
export async function generateImage({ prompt, aspectRatio = '1:1' }) {
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    throw new OpenAIImageError('프롬프트가 비어있습니다.', { code: 'INVALID_PROMPT' });
  }

  const client = getClient();
  const size = resolveSize(aspectRatio);
  const { width, height } = sizeToDimensions(size);

  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.images.generate({
        model: MODEL,
        prompt,
        size,
        quality: QUALITY,
        n: 1,
        output_format: 'png',
      });

      const item = response?.data?.[0];
      const b64 = item?.b64_json;
      if (!b64) {
        throw new OpenAIImageError('OpenAI 응답에 이미지가 없습니다.', { code: 'NO_IMAGE', retriable: true });
      }

      return {
        url: `data:image/png;base64,${b64}`,
        width,
        height,
        seed: null,
        contentType: 'image/png',
      };
    } catch (err) {
      lastError = err;
      const status = err?.status;
      const code = status === 401 ? 'NO_API_KEY'
                : status === 403 ? 'BALANCE_OR_AUTH'
                : status === 429 ? 'RATE_LIMIT'
                : status === 400 ? 'BAD_PROMPT'
                : status >= 500 ? 'UPSTREAM'
                : err?.code || 'UNKNOWN';
      const retriable = code === 'RATE_LIMIT' || code === 'UPSTREAM' || code === 'NO_IMAGE';
      if (attempt < MAX_RETRIES && retriable) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      if (!(err instanceof OpenAIImageError)) {
        throw new OpenAIImageError(`OpenAI 호출 실패: ${err.message || 'unknown'}`, { code, status, retriable, cause: err });
      }
      throw err;
    }
  }

  if (lastError instanceof OpenAIImageError) throw lastError;
  throw new OpenAIImageError(`OpenAI 호출 실패: ${lastError?.message || 'unknown'}`, { code: 'UNKNOWN', cause: lastError });
}

/**
 * data URL 기반이라 별도 버킷 영속화 불필요. falai 인터페이스 호환용으로 noop 제공.
 * @returns {Promise<{ bucketKey: null, finalUrl: string }>}
 */
export async function persistImageToBucket(dataUrl /*, projectId, cardIndex */) {
  return { bucketKey: null, finalUrl: dataUrl };
}

/**
 * 병렬 생성 (동시성 제한 + 부분 실패 허용). falai와 동일한 인터페이스.
 */
export async function generateImagesBatch(requests, concurrency = 3) {
  const results = new Array(requests.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const idx = cursor++;
      if (idx >= requests.length) return;
      try {
        const r = await generateImage(requests[idx]);
        results[idx] = { success: true, result: r, index: idx };
      } catch (e) {
        results[idx] = {
          success: false,
          error: e.message,
          code: e.code,
          index: idx,
        };
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, requests.length) }, worker);
  await Promise.all(workers);
  return results;
}

export { OpenAIImageError };
