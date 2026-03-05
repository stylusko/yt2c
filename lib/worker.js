import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { getTempPath, getOutputPath, cleanup } from './storage.js';

const execFileAsync = promisify(execFile);

/**
 * Parse time string ("1:10", "3:42:15", "90") to seconds
 */
function parseTimeToSeconds(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const parts = String(str).trim().split(":").map(Number);
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

/**
 * Convert seconds to HH:MM:SS format
 */
function secondsToTime(seconds) {
  const s = Math.floor(seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return [hours, minutes, secs].map(v => String(v).padStart(2, '0')).join(':');
}

/**
 * Builds FFmpeg filter chain for cropping video to target dimensions
 * @param {number} vw - source video width
 * @param {number} vh - source video height
 * @param {number} outW - target output width
 * @param {number} outH - target output height
 * @param {number[]} videoPos - [x%, y%] position
 * @param {number} videoScale - zoom percentage
 * @param {string} videoFill - "full" or "split"
 * @param {string} layout - "photo_top", "photo_bottom", or "text_overlay"
 * @param {number} photoRatio - ratio of photo area (0-1)
 */
function buildFilterChain(vw, vh, outW, outH, videoPos, videoScale, videoFill, layout, photoRatio) {
  const [vx, vy] = videoPos || [50, 50];
  const zoom = Math.max(videoScale || 110, 100) / 100;
  const aspect = vw / vh;

  if (videoFill === 'split' && layout !== 'text_overlay') {
    // 분리형: 영상은 영상 영역에만 배치
    const textH = Math.round(outH * (1 - (photoRatio || 0.55)));
    const videoH = outH - textH;
    const videoY = layout === 'photo_top' ? 0 : textH;

    // Scale video to fill the video area
    const videoAspect = outW / videoH;
    let scaleW, scaleH;
    if (aspect >= videoAspect) {
      scaleH = Math.round(videoH * zoom);
      scaleW = Math.round(scaleH * aspect);
    } else {
      scaleW = Math.round(outW * zoom);
      scaleH = Math.round(scaleW / aspect);
    }

    const maxOffX = Math.max(scaleW - outW, 0);
    const maxOffY = Math.max(scaleH - videoH, 0);
    const offX = Math.round((maxOffX * vx) / 100);
    const offY = Math.round((maxOffY * vy) / 100);

    // Create: scale → crop to video area → pad to full output with black → overlay
    return `scale=${scaleW}:${scaleH},crop=${outW}:${videoH}:${offX}:${offY},pad=${outW}:${outH}:0:${videoY}:black[scaled];[scaled][1:v]overlay=0:0`;
  }

  // 전체 채우기: 영상이 전체 카드에 깔림
  let scaleW, scaleH;
  const outAspect = outW / outH;
  if (aspect >= outAspect) {
    scaleH = Math.round(outH * zoom);
    scaleW = Math.round(scaleH * aspect);
  } else {
    scaleW = Math.round(outW * zoom);
    scaleH = Math.round(scaleW / aspect);
  }

  const maxOffX = Math.max(scaleW - outW, 0);
  const maxOffY = Math.max(scaleH - outH, 0);
  const offX = Math.round((maxOffX * vx) / 100);
  const offY = Math.round((maxOffY * vy) / 100);

  return `scale=${scaleW}:${scaleH},crop=${outW}:${outH}:${offX}:${offY}[scaled];[scaled][1:v]overlay=0:0`;
}

/**
 * Gets video dimensions using ffprobe
 */
async function getVideoDimensions(videoPath) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'csv=s=x:p=0',
    videoPath,
  ]);
  const [width, height] = stdout.trim().split('x').map(Number);
  if (!width || !height) throw new Error('Could not determine video dimensions');
  return { width, height };
}

/**
 * Downloads YouTube video segment
 */
async function downloadYouTubeSegment(url, startSec, endSec, outputPath) {
  const startTime = secondsToTime(startSec);
  const endTime = secondsToTime(endSec);

  console.log(`  yt-dlp: downloading ${startTime} - ${endTime}`);

  await execFileAsync('yt-dlp', [
    '--download-sections', `*${startTime}-${endTime}`,
    '-f', 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    '--force-keyframes-at-cuts',
    '--merge-output-format', 'mp4',
    '--js-runtimes', 'node',
    '-o', outputPath,
    '--no-playlist',
    url,
  ], { timeout: 120000 }); // 2 minute timeout
}

/**
 * Processes a single card (video or image)
 */
export async function processCard({
  jobId,
  cardConfig,
  url,
  cardIdx,
  overlayPath,
  outputFormat = 'mp4',
  outputSize = 1080,
}) {
  // Parse time strings to seconds
  const startSec = parseTimeToSeconds(cardConfig.start);
  const endSec = parseTimeToSeconds(cardConfig.end);

  if (endSec <= startSec) {
    throw new Error(`Invalid time range: ${cardConfig.start} - ${cardConfig.end}`);
  }

  // Setup paths
  const downloadedVideo = getTempPath(jobId, `segment_${cardIdx}.mp4`);
  const ext = outputFormat === 'jpg' || outputFormat === 'image' ? 'jpg' : 'mp4';
  const outputPath = getOutputPath(`${jobId}_${cardIdx}`, ext);

  try {
    // Step 1: Download YouTube segment
    console.log(`[${jobId}] Downloading segment ${cardIdx}: ${secondsToTime(startSec)} - ${secondsToTime(endSec)}`);
    await downloadYouTubeSegment(url, startSec, endSec, downloadedVideo);

    if (!fs.existsSync(downloadedVideo)) {
      throw new Error('Downloaded video file not found');
    }

    // Step 2: Get video dimensions
    console.log(`[${jobId}] Getting video dimensions`);
    const { width, height } = await getVideoDimensions(downloadedVideo);
    console.log(`[${jobId}] Video: ${width}x${height}`);

    // Step 3: Compute output dimensions based on aspect ratio
    const ar = cardConfig.aspect_ratio || '1:1';
    const outW = outputSize;
    const outH = ar === '3:4' ? Math.round(outputSize * 4 / 3) : outputSize;

    // Step 4: Build filter chain (handles full vs split video fill)
    const filterChain = buildFilterChain(
      width, height, outW, outH,
      cardConfig.video_position,
      cardConfig.video_scale,
      cardConfig.video_fill || 'full',
      cardConfig.layout || 'photo_top',
      cardConfig.photo_ratio || 0.55
    );

    if (ext === 'mp4') {
      // Encode video with overlay
      console.log(`[${jobId}] Encoding video with overlay`);
      await execFileAsync('ffmpeg', [
        '-i', downloadedVideo,
        '-i', overlayPath,
        '-filter_complex', filterChain,
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart',
        '-y',
        outputPath,
      ], { timeout: 300000 }); // 5 minute timeout
    } else {
      // Extract single frame with overlay (image mode)
      console.log(`[${jobId}] Extracting frame for image card`);
      const captureTimeSec = parseTimeToSeconds(cardConfig.capture_time);
      const seekTime = captureTimeSec > 0
        ? Math.min(captureTimeSec - startSec, endSec - startSec)
        : Math.min(1, (endSec - startSec) * 0.25);

      await execFileAsync('ffmpeg', [
        '-ss', String(Math.max(0, seekTime)),
        '-i', downloadedVideo,
        '-i', overlayPath,
        '-vframes', '1',
        '-filter_complex', filterChain,
        '-y',
        outputPath,
      ], { timeout: 60000 });
    }

    console.log(`[${jobId}] Card ${cardIdx} done: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`[${jobId}] Error card ${cardIdx}:`, error.message);
    throw error;
  } finally {
    // Clean up downloaded video
    try {
      if (fs.existsSync(downloadedVideo)) fs.unlinkSync(downloadedVideo);
    } catch (e) {}
  }
}
