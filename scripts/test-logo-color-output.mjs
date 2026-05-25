import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const OUT = 1080;
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'yt2c-logo-color-'));
process.env.STORAGE_DIR = path.join(tmpRoot, 'storage');

process.env.BUCKET_ENDPOINT = '';
process.env.AWS_ENDPOINT_URL = '';
process.env.BUCKET_ACCESS_KEY_ID = '';
process.env.AWS_ACCESS_KEY_ID = '';
process.env.BUCKET_SECRET_ACCESS_KEY = '';
process.env.AWS_SECRET_ACCESS_KEY = '';

const { processCard } = await import('../lib/worker.js');

function run(cmd, args) {
  return execFileSync(cmd, args, { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 });
}

function sampleRgb(file, x, y) {
  const bytes = run('ffmpeg', [
    '-v', 'error',
    '-i', file,
    '-vf', `crop=w=2:h=2:x=${Math.round(x)}:y=${Math.round(y)},scale=1:1,format=rgb24`,
    '-f', 'rawvideo',
    '-',
  ]);
  return [bytes[0], bytes[1], bytes[2]];
}

function assertNear(actual, expected, tolerance, label) {
  const dist = Math.sqrt(
    (actual[0] - expected[0]) ** 2 +
    (actual[1] - expected[1]) ** 2 +
    (actual[2] - expected[2]) ** 2
  );
  if (dist > tolerance) {
    throw new Error(`${label} expected near ${expected.join(',')}, got ${actual.join(',')}`);
  }
  console.log(`PASS ${label}: ${actual.join(',')} ~= ${expected.join(',')}`);
}

try {
  const background = path.join(tmpRoot, 'background.png');
  const overlay = path.join(tmpRoot, 'white-logo-overlay.png');
  const outputCopy = '/tmp/yt2c-logo-color-output.jpg';

  run('ffmpeg', [
    '-v', 'error',
    '-f', 'lavfi',
    '-i', `color=c=0x111111:s=${OUT}x${OUT}`,
    '-vf', 'drawbox=x=0:y=0:w=1080:h=500:color=0x232342:t=fill,drawbox=x=0:y=500:w=1080:h=580:color=0x111111:t=fill',
    '-frames:v', '1',
    '-y',
    background,
  ]);

  run('ffmpeg', [
    '-v', 'error',
    '-f', 'lavfi',
    '-i', `color=c=black@0.0:s=${OUT}x${OUT},format=rgba`,
    '-vf', 'drawbox=x=410:y=900:w=260:h=84:color=white@1:t=fill:replace=1,drawbox=x=440:y=925:w=200:h=34:color=0x111111@1:t=fill:replace=1,drawbox=x=478:y=934:w=124:h=16:color=white@1:t=fill:replace=1',
    '-frames:v', '1',
    '-y',
    overlay,
  ]);

  const outputPath = await processCard({
    jobId: 'logo-color',
    cardIdx: 0,
    cardConfig: {
      start: '0:00',
      end: '0:05',
      aspect_ratio: '1:1',
      layout: 'full_bg',
      video_fill: 'full',
      video_position: [0, 0],
      video_scale: 100,
      video_brightness: 0,
      image_fit: 'cover',
    },
    url: '',
    overlayPath: overlay,
    backgroundPath: background,
    outputFormat: 'jpg',
    outputSize: OUT,
  }).then(result => result.outputPath);

  fs.copyFileSync(outputPath, outputCopy);
  assertNear(sampleRgb(outputCopy, 420, 910), [255, 255, 255], 18, 'solid white logo body in final jpg');
  assertNear(sampleRgb(outputCopy, 540, 940), [255, 255, 255], 18, 'solid white logo inner mark in final jpg');
  assertNear(sampleRgb(outputCopy, 540, 820), [17, 17, 17], 18, 'background remains un-tinted outside logo');
  console.log(`logo color output image: ${outputCopy}`);
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
