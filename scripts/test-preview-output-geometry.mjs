import { execFileSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const OUT = 1080;
const SRC_W = 800;
const SRC_H = 1200;

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yt2c-preview-output-'));
process.env.STORAGE_DIR = path.join(tmpRoot, 'storage');

// Keep this test local-only even when developer machines have bucket env vars set.
process.env.BUCKET_ENDPOINT = '';
process.env.AWS_ENDPOINT_URL = '';
process.env.BUCKET_ACCESS_KEY_ID = '';
process.env.AWS_ACCESS_KEY_ID = '';
process.env.BUCKET_SECRET_ACCESS_KEY = '';
process.env.AWS_SECRET_ACCESS_KEY = '';

const { processCard, buildFilterChain } = await import('../lib/worker.js');

function run(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { stdio: opts.stdio || 'pipe', maxBuffer: 16 * 1024 * 1024 });
}

function even(n) {
  return Math.round(n / 2) * 2;
}

function normalizeRatio(value, fallback = 0.55) {
  const raw = Number(value);
  const ratio = Number.isFinite(raw) && raw > 0 ? (raw > 1 ? raw / 100 : raw) : fallback;
  return Math.max(0.1, Math.min(0.95, ratio));
}

function dist(a, b) {
  return Math.sqrt(
    (a[0] - b[0]) ** 2 +
    (a[1] - b[1]) ** 2 +
    (a[2] - b[2]) ** 2
  );
}

function closeRgb(actual, expected, tolerance = 36) {
  return dist(actual, expected) <= tolerance;
}

function rgbName([r, g, b]) {
  return `${r},${g},${b}`;
}

function sampleRgb(file, x, y) {
  // crop=1:1 can be parsed incorrectly on some ffmpeg builds, so crop 2x2 and downscale.
  const bytes = run('ffmpeg', [
    '-v', 'error',
    '-i', file,
    '-vf', `crop=w=2:h=2:x=${Math.round(x)}:y=${Math.round(y)},scale=1:1,format=rgb24`,
    '-f', 'rawvideo',
    '-',
  ]);
  return [bytes[0], bytes[1], bytes[2]];
}

function rawRgbHash(file) {
  const bytes = run('ffmpeg', [
    '-v', 'error',
    '-i', file,
    '-vf', 'format=rgb24',
    '-f', 'rawvideo',
    '-',
  ]);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sourceColorAt(sx, sy) {
  // Must match the generated source image below.
  if (sy < 160) return [0, 128, 0];       // green top stripe
  if (sy >= 1040) return [255, 255, 0];   // yellow bottom stripe
  if (sx >= 300 && sx < 500) return [0, 0, 255]; // blue center stripe
  return [255, 0, 0];                     // red base
}

function expectedPreviewPixel(config, x, y) {
  const layout = config.layout || 'photo_top';
  const photoRatio = normalizeRatio(config.photo_ratio);
  const split = config.video_fill === 'split' &&
    layout !== 'full_bg' &&
    layout !== 'video_only' &&
    layout !== 'text_box' &&
    layout !== 'none';
  const textH = split ? Math.round(OUT * (1 - photoRatio)) : 0;
  const mediaH = split ? OUT - textH : OUT;
  const mediaTop = split && layout === 'photo_bottom' ? textH : 0;
  const localY = y - mediaTop;
  if (localY < 0 || localY >= mediaH) return [0, 0, 0];

  const aspect = SRC_W / SRC_H;
  const targetAspect = OUT / mediaH;
  const zoom = Math.max(config.video_scale ?? 100, 1) / 100;
  const fitMode = config.image_fit === 'cover' || config.source_type === 'article'
    ? 'cover'
    : 'contain';

  let scaleW;
  let scaleH;
  if (fitMode === 'contain' ? aspect >= targetAspect : aspect < targetAspect) {
    scaleW = even(Math.round(OUT * zoom));
    scaleH = even(Math.round(scaleW / aspect));
  } else {
    scaleH = even(Math.round(mediaH * zoom));
    scaleW = even(Math.round(scaleH * aspect));
  }

  const [rawX, rawY] = config.video_position || [0, 0];
  const left = Math.round((OUT - scaleW) / 2 - scaleW * rawX / 400);
  const top = Math.round((mediaH - scaleH) / 2 - scaleH * rawY / 400);
  if (x < left || x >= left + scaleW || localY < top || localY >= top + scaleH) {
    return [0, 0, 0];
  }

  const sx = (x - left) / scaleW * SRC_W;
  const sy = (localY - top) / scaleH * SRC_H;
  return sourceColorAt(sx, sy);
}

async function renderCase(name, config, backgroundPath, overlayPath) {
  const result = await processCard({
    jobId: name,
    cardIdx: 0,
    cardConfig: {
      start: '0:00',
      end: '0:05',
      aspect_ratio: '1:1',
      video_brightness: 0,
      ...config,
    },
    url: '',
    overlayPath,
    backgroundPath,
    outputFormat: 'jpg',
    outputSize: OUT,
  });
  return result.outputPath;
}

function assertSample(file, config, label, x, y) {
  const actual = sampleRgb(file, x, y);
  const expected = expectedPreviewPixel(config, x, y);
  if (!closeRgb(actual, expected)) {
    throw new Error(`${label} expected ${rgbName(expected)} at ${x},${y}, got ${rgbName(actual)}`);
  }
  console.log(`PASS ${label}: ${rgbName(actual)} ~= ${rgbName(expected)}`);
}

function assertSamePixels(fileA, fileB, label) {
  const a = rawRgbHash(fileA);
  const b = rawRgbHash(fileB);
  if (a !== b) throw new Error(`${label} RGB hash mismatch: ${a} !== ${b}`);
  console.log(`PASS ${label}: RGB hash ${a.slice(0, 12)}`);
}

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) throw new Error(`${label} expected filter to include ${expected}, got ${value}`);
  console.log(`PASS ${label}: ${expected}`);
}

try {
  const scaledVideoFilter = buildFilterChain(
    1080, 1920, OUT, OUT,
    [0, 0],
    70,
    'full',
    'photo_top',
    0.5,
    0,
    undefined,
    false
  );
  assertIncludes(scaledVideoFilter, 'scale=756:1344', 'video output keeps preview scale');
  assertIncludes(scaledVideoFilter, 'overlay=162:-132', 'video output keeps preview position');

  const source = path.join(tmpRoot, 'source.png');
  const overlay = path.join(tmpRoot, 'overlay.png');

  run('ffmpeg', [
    '-v', 'error',
    '-f', 'lavfi',
    '-i', `color=c=red:s=${SRC_W}x${SRC_H},drawbox=x=300:y=0:w=200:h=${SRC_H}:color=blue:t=fill,drawbox=x=0:y=0:w=${SRC_W}:h=160:color=green:t=fill,drawbox=x=0:y=1040:w=${SRC_W}:h=160:color=yellow:t=fill`,
    '-frames:v', '1',
    '-y',
    source,
  ]);
  run('ffmpeg', [
    '-v', 'error',
    '-f', 'lavfi',
    '-i', `nullsrc=s=${OUT}x${OUT},format=rgba,colorchannelmixer=aa=0`,
    '-frames:v', '1',
    '-y',
    overlay,
  ]);

  const splitTop = {
    layout: 'photo_top',
    photo_ratio: 0.5,
    video_fill: 'split',
    video_position: [0, 0],
    video_scale: 100,
  };
  const splitBottom = {
    layout: 'photo_bottom',
    photo_ratio: 50,
    video_fill: 'split',
    video_position: [0, 0],
    video_scale: 100,
  };
  const splitZoom = {
    layout: 'photo_top',
    photo_ratio: 0.5,
    video_fill: 'split',
    video_position: [80, -60],
    video_scale: 150,
  };
  const fullContain = {
    layout: 'photo_top',
    photo_ratio: 0.5,
    video_fill: 'full',
    video_position: [0, 0],
    video_scale: 100,
  };
  const articleCover = {
    layout: 'photo_top',
    photo_ratio: 0.5,
    video_fill: 'split',
    video_position: [0, 0],
    video_scale: 100,
    image_fit: 'cover',
    image_area: 'photo',
    source_type: 'article',
  };

  const splitTopOut = await renderCase('split-top', splitTop, source, overlay);
  const splitBottomOut = await renderCase('split-bottom', splitBottom, source, overlay);
  const splitZoomOut = await renderCase('split-zoom', splitZoom, source, overlay);
  const fullOut = await renderCase('full-contain', fullContain, source, overlay);
  const articleCoverOut = await renderCase('article-cover', articleCover, source, overlay);

  assertSample(splitTopOut, splitTop, 'split top left letterbox', 20, 20);
  assertSample(splitTopOut, splitTop, 'split top media center', 540, 270);
  assertSample(splitTopOut, splitTop, 'split top text area', 540, 800);
  assertSample(splitBottomOut, splitBottom, 'split bottom text area', 540, 200);
  assertSample(splitBottomOut, splitBottom, 'split bottom media center', 540, 810);
  assertSample(splitZoomOut, splitZoom, 'split zoom shifted sample A', 360, 90);
  assertSample(splitZoomOut, splitZoom, 'split zoom shifted sample B', 700, 430);
  assertSample(fullOut, fullContain, 'full left letterbox', 20, 540);
  assertSample(fullOut, fullContain, 'full center', 540, 540);
  assertSample(articleCoverOut, articleCover, 'article cover top-left', 20, 20);
  assertSample(articleCoverOut, articleCover, 'article cover center', 540, 270);

  const easyLike = {
    layout: 'photo_top',
    photo_ratio: 0.5,
    video_fill: 'split',
    video_position: [32, -24],
    video_scale: 125,
  };
  const freeLike = { ...easyLike };
  const easyOut = await renderCase('easy-like', easyLike, source, overlay);
  const freeOut = await renderCase('free-like', freeLike, source, overlay);
  assertSamePixels(easyOut, freeOut, 'easy/free identical config output');

  console.log('preview/output geometry tests passed');
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
