// Fal.ai Flux 1.1 Pro 이미지 생성 래퍼
// - 단건 생성 + 병렬 생성
// - Fal CDN URL을 버킷(R2)으로 복사 저장해 영속화
// - 재시도 + 에러 분류
// - 비율·시드·스타일 프리셋 지원

import { uploadFile } from './bucket.js';
import { getTempPath, cleanup } from './storage.js';
import fs from 'fs';
import crypto from 'crypto';

const FAL_ENDPOINT = 'https://fal.run/fal-ai/flux-pro/v1.1';
const DEFAULT_TIMEOUT_MS = 60000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

// 종횡비 → Fal image_size (custom width/height 객체)
// Flux 1.1 Pro 요금: $0.04 per megapixel, 올림 과금.
// → 전부 1 MP 이하(0.8~0.95 MP)로 제한해 장당 $0.04 (≈ 55원) 고정.
// 최종 렌더 1080px 대비 약 1.1~1.5× 업스케일 발생하지만 Flux 출력이 선명해 허용 가능.
const ASPECT_TO_SIZE = {
  '1:1':  { width: 960,  height: 960  }, // 0.92 MP (정확히 1:1)
  '4:5':  { width: 800,  height: 1000 }, // 0.80 MP (정확히 4:5)
  '9:16': { width: 720,  height: 1280 }, // 0.92 MP (정확히 9:16)
  '16:9': { width: 1280, height: 720  }, // 0.92 MP
  '3:4':  { width: 864,  height: 1152 }, // 0.995 MP (정확히 3:4)
};

function resolveImageSize(aspectRatio) {
  return ASPECT_TO_SIZE[aspectRatio] || ASPECT_TO_SIZE['1:1'];
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

class FalError extends Error {
  constructor(message, { code, status, retriable, cause } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.retriable = retriable;
    this.cause = cause;
  }
}

/**
 * Flux 1.1 Pro에 프롬프트 하나로 이미지 1장 생성
 * @param {object} params
 * @param {string} params.prompt - 이미지 생성 프롬프트 (영문/국문 모두 OK)
 * @param {string} params.aspectRatio - '1:1' | '4:5' | '9:16' | ...
 * @param {number} [params.seed] - 재현용 시드
 * @param {number} [params.numInferenceSteps] - 28 기본
 * @param {number} [params.guidanceScale] - 3.5 기본
 * @returns {Promise<{ url: string, width: number, height: number, seed: number, contentType: string }>}
 */
export async function generateImage({ prompt, aspectRatio = '1:1', seed, numInferenceSteps, guidanceScale }) {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new FalError('FAL_KEY가 설정되지 않았습니다.', { code: 'NO_API_KEY' });
  if (!prompt || typeof prompt !== 'string') {
    throw new FalError('프롬프트가 비어있습니다.', { code: 'INVALID_PROMPT' });
  }

  const body = {
    prompt,
    image_size: resolveImageSize(aspectRatio),
    num_images: 1,
    enable_safety_checker: true,
    output_format: 'png',   // PNG 무손실 — 에디터에서 crop/scale 시 품질 저하 최소화
    safety_tolerance: '2',  // 2 = balanced (Flux Pro 기본)
  };
  if (typeof seed === 'number') body.seed = seed;
  if (typeof numInferenceSteps === 'number') body.num_inference_steps = numInferenceSteps;
  if (typeof guidanceScale === 'number') body.guidance_scale = guidanceScale;

  let lastError = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const res = await fetch(FAL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);

      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch {}

      if (!res.ok) {
        // 403 잔액 부족, 429 rate limit, 400 프롬프트 거절, 5xx 일시 오류
        const detail = data?.detail || data?.error || text.slice(0, 200);
        const code = res.status === 403 ? 'BALANCE_OR_AUTH'
                  : res.status === 429 ? 'RATE_LIMIT'
                  : res.status === 400 ? 'BAD_PROMPT'
                  : res.status >= 500 ? 'UPSTREAM'
                  : 'HTTP_ERROR';
        const retriable = code === 'RATE_LIMIT' || code === 'UPSTREAM';
        throw new FalError(`Fal.ai ${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`, {
          code, status: res.status, retriable,
        });
      }

      if (!data || !data.images || !data.images[0]) {
        throw new FalError('Fal.ai 응답에 이미지가 없습니다.', { code: 'NO_IMAGE', retriable: true });
      }

      const img = data.images[0];

      // NSFW 체크 (프론트에서도 한 번 더 확인 가능)
      if (Array.isArray(data.has_nsfw_concepts) && data.has_nsfw_concepts[0] === true) {
        throw new FalError('생성 이미지가 안전필터에 걸렸습니다.', { code: 'NSFW_FLAGGED', retriable: false });
      }

      return {
        url: img.url,
        width: img.width,
        height: img.height,
        seed: data.seed,
        contentType: img.content_type || 'image/jpeg',
      };
    } catch (err) {
      lastError = err;
      const isRetriable = err instanceof FalError ? err.retriable : (err.name === 'AbortError');
      if (attempt < MAX_RETRIES && isRetriable) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      break;
    }
  }

  if (lastError instanceof FalError) throw lastError;
  throw new FalError(`Fal.ai 호출 실패: ${lastError?.message || 'unknown'}`, { code: 'UNKNOWN', cause: lastError });
}

/**
 * Fal CDN 이미지 URL을 버킷에 영속화 (CDN 휘발성 대응)
 * 버킷 미설정 시 원본 URL을 그대로 반환.
 * @param {string} cdnUrl - Fal CDN URL
 * @param {string} projectId
 * @param {number|string} cardIndex
 * @returns {Promise<{ bucketKey: string|null, finalUrl: string }>}
 */
export async function persistImageToBucket(cdnUrl, projectId, cardIndex) {
  if (!cdnUrl) throw new FalError('URL이 비어있습니다.', { code: 'INVALID_URL' });

  // 다운로드
  const res = await fetch(cdnUrl);
  if (!res.ok) throw new FalError(`Fal CDN 다운로드 실패 ${res.status}`, { code: 'CDN_DOWNLOAD' });
  const buffer = Buffer.from(await res.arrayBuffer());

  // 해시 기반 파일명으로 디듭 방지
  const hash = crypto.createHash('md5').update(buffer).digest('hex').slice(0, 12);
  const ext = /\.(jpe?g|png|webp)(\?|$)/i.exec(cdnUrl)?.[1]?.toLowerCase() || 'jpg';
  const filename = `ai_${cardIndex}_${hash}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const tempPath = getTempPath(`falai_${projectId}`, filename);
  fs.writeFileSync(tempPath, buffer);

  const bucketKey = `ai-images/${projectId}/${filename}`;
  try {
    const uploaded = await uploadFile(bucketKey, tempPath, `image/${ext === 'jpg' ? 'jpeg' : ext}`);
    // 임시 파일 정리
    try { cleanup(`falai_${projectId}`); } catch {}

    if (!uploaded) {
      // 버킷 미설정 or 업로드 실패 → CDN URL 폴백
      return { bucketKey: null, finalUrl: cdnUrl };
    }
    return { bucketKey, finalUrl: null }; // finalUrl은 호출측이 presigned URL로 발급
  } catch (e) {
    try { cleanup(`falai_${projectId}`); } catch {}
    console.warn('[falai] persist to bucket failed, fallback to CDN URL:', e.message);
    return { bucketKey: null, finalUrl: cdnUrl };
  }
}

/**
 * 병렬 생성 (동시 호출 제한 + 부분 실패 허용)
 * @param {Array<{prompt: string, aspectRatio?: string, seed?: number}>} requests
 * @param {number} concurrency
 * @returns {Promise<Array<{success: boolean, result?: object, error?: string, index: number}>>}
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

export { FalError };
