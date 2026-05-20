// Railway Storage Bucket (S3 호환) 클라이언트
// 생성된 카드 파일 업로드/다운로드/삭제

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import crypto from 'crypto';

const BUCKET_NAME = process.env.BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || 'youmeca-cards';
const PRESIGNED_EXPIRY = 3600; // 1시간

let _s3 = null;
function getS3() {
  if (_s3) return _s3;
  const endpoint = process.env.BUCKET_ENDPOINT || process.env.AWS_ENDPOINT_URL;
  const accessKeyId = process.env.BUCKET_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.BUCKET_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    console.warn('[bucket] Bucket credentials not configured');
    return null;
  }
  _s3 = new S3Client({
    region: 'us-east-1',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });
  return _s3;
}

/**
 * 파일을 bucket에 업로드
 * @param {string} key - 저장 경로 (예: "cards/abc123/0_hash.mp4")
 * @param {string} filePath - 로컬 파일 경로
 * @param {string} contentType - MIME type
 * @returns {Promise<string|null>} 업로드된 key 또는 null
 */
export async function uploadFile(key, filePath, contentType) {
  const s3 = getS3();
  if (!s3) return null;
  try {
    const body = fs.readFileSync(filePath);
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    console.log(`[bucket] uploaded: ${key} (${(body.length / 1024 / 1024).toFixed(1)}MB)`);
    return key;
  } catch (err) {
    console.error('[bucket] upload failed:', err.message);
    return null;
  }
}

/**
 * 파일 다운로드용 presigned URL 발급
 * @param {string} key
 * @param {number} expiresIn - URL 유효 시간 (초, 기본 1시간)
 * @returns {Promise<string|null>}
 */
export async function getDownloadUrl(key, expiresIn = PRESIGNED_EXPIRY) {
  const s3 = getS3();
  if (!s3) return null;
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    return await getSignedUrl(s3, command, { expiresIn });
  } catch (err) {
    console.error('[bucket] presign failed:', err.message);
    return null;
  }
}

/**
 * 파일 존재 여부 확인
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function fileExists(key) {
  const s3 = getS3();
  if (!s3) return false;
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * 파일 삭제
 * @param {string} key
 */
export async function deleteFile(key) {
  const s3 = getS3();
  if (!s3) return;
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    console.log(`[bucket] deleted: ${key}`);
  } catch (err) {
    console.error('[bucket] delete failed:', err.message);
  }
}

/**
 * 여러 파일 삭제
 * @param {string[]} keys
 */
export async function deleteFiles(keys) {
  for (const key of keys) await deleteFile(key);
}

/**
 * 카드 설정 해시 생성 (변경 감지용)
 * @param {object} card - 카드 객체
 * @param {object} globalConfig - { aspectRatio, outputSize, outputFormat, globalUrl }
 * @returns {string} 12자 해시
 */
export function generateCardHash(card, globalConfig) {
  const data = {
    ar: globalConfig.aspectRatio, os: globalConfig.outputSize, of: globalConfig.outputFormat,
    url: card.url || globalConfig.globalUrl || '',
    start: card.appliedStart || card.start || '', end: card.appliedEnd || card.end || '',
    vx: card.videoX ?? 0, vy: card.videoY ?? 0, vs: card.videoScale ?? 100, vb: card.videoBrightness ?? 0,
    layout: card.layout || 'photo_top', ug: card.useGradient || false, pr: card.photoRatio ?? 50,
    vf: card.videoFill || 'full', fs: card.fillSource || 'video',
    title: card.title || '', ut: card.useTitle !== false,
    sub: card.subtitle || '', us: card.useSubtitle !== false,
    body: card.body || '', ub: card.useBody !== false,
    ts: card.titleSize || 64, tc: card.titleColor || '#fff', tf: card.titleFont || '',
    ss: card.subtitleSize || 48, sc: card.subtitleColor || '#aaa',
    bs: card.bodySize || 40, bc: card.bodyColor || '#d2d2d2',
    bgc: card.bgColor || '#121212', bgo: card.bgOpacity ?? 0.75, useBg: card.useBg !== false,
    ovl: (card.overlays || []).map(o => ({ s: o.src || '', x: o.x, y: o.y, w: o.width, h: o.height, op: o.opacity })),
    ui: card.uploadedImage ? 'y' : 'n',
    tbx: card.textBoxX ?? 50, tby: card.textBoxY ?? 70, tbw: card.textBoxWidth ?? 80,
    tbbc: card.textBoxBgColor || '#000', tbbo: card.textBoxBgOpacity ?? 0.6,
    ta: card.titleAlign || 'left', sa: card.subtitleAlign || 'left', ba: card.bodyAlign || 'left',
  };
  return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex').slice(0, 12);
}

/**
 * 버킷 key 생성
 * @param {string} projectId
 * @param {number} cardIndex
 * @param {string} ext - 'mp4' or 'jpg'
 * @param {string} hash
 * @returns {string}
 */
export function makeBucketKey(projectId, cardIndex, ext, hash) {
  return `cards/${projectId}/${cardIndex}_${hash}.${ext}`;
}
