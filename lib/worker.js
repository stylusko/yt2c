import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { getTempPath, getOutputPath, cleanup } from './storage.js';

const execFileAsync = promisify(execFile);

/**
 * Builds FFmpeg filter chain for cropping video to 1:1
 * @param {number} vw - Video width
 * @param {number} vh - Video height
 * @param {number} size - Target output size (1080 for standard)
 * @param {number[]} videoPos - Position [x, y] as percentage (0-100)
 * @param {number} videoScale - Scale percentage (default 110)
 * @returns {string} FFmpeg filter string
 */
function buildCropFilter(vw, vh, size, videoPos, videoScale) {
  const [vx, vy] = videoPos || [50, 50];
  const zoom = Math.max(videoScale || 110, 100) / 100;
  const aspect = vw / vh;

  let scaleW, scaleH;
  if (aspect >= 1) {
    scaleH = Math.round(size * zoom);
    scaleW = Math.round(scaleH * aspect);
  } else {
    scaleW = Math.round(size * zoom);
    scaleH = Math.round(scaleW / aspect);
  }

  const maxOffX = Math.max(scaleW - size, 0);
  const maxOffY = Math.max(scaleH - size, 0);
  const offX = Math.round((maxOffX * vx) / 100);
  const offY = Math.round((maxOffY * vy) / 100);

  return `scale=${scaleW}:${scaleH},crop=${size}:${size}:${offX}:${offY}`;
}

/**
 * Gets video dimensions using ffprobe
 * @param {string} videoPath - Path to video file
 * @returns {Promise<{width: number, height: number}>}
 */
async function getVideoDimensions(videoPath) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height',
      '-of', 'csv=s=x:p=0',
      videoPath,
    ]);

    const [width, height] = stdout.trim().split('x').map(Number);
    return { width, height };
  } catch (error) {
    throw new Error(`Failed to get video dimensions: ${error.message}`);
  }
}

/**
 * Downloads YouTube video segment
 * @param {string} url - YouTube URL
 * @param {string} start - Start time (HH:MM:SS)
 * @param {string} end - End time (HH:MM:SS)
 * @param {string} outputPath - Where to save the segment
 * @returns {Promise<void>}
 */
async function downloadYouTubeSegment(url, start, end, outputPath) {
  try {
    await execFileAsync('yt-dlp', [
      '--download-sections', `*${start}-${end}`,
      '-f', 'bestvideo+bestaudio',
      '--force-keyframes-at-cuts',
      '-o', outputPath,
      url,
    ]);
  } catch (error) {
    throw new Error(`Failed to download YouTube segment: ${error.message}`);
  }
}

/**
 * Processes a single card (video or image)
 * @param {Object} config - Configuration object
 * @param {string} config.jobId - Job ID
 * @param {Object} config.cardConfig - Card configuration
 * @param {number} config.cardConfig.start - Start time in seconds
 * @param {number} config.cardConfig.end - End time in seconds
 * @param {number[]} config.cardConfig.video_position - Position [x, y]
 * @param {number} config.cardConfig.video_scale - Scale percentage
 * @param {string} config.cardConfig.type - 'video' or 'image'
 * @param {string} config.url - YouTube URL
 * @param {number} config.cardIdx - Card index
 * @param {string} config.overlayPath - Path to overlay PNG
 * @param {string} config.outputFormat - Output format (mp4 or png)
 * @param {number} config.outputSize - Output size (default 1080)
 * @returns {Promise<string>} Output file path
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
  // Convert seconds to HH:MM:SS format
  const secondsToTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return [hours, minutes, secs]
      .map(v => String(v).padStart(2, '0'))
      .join(':');
  };

  const start = secondsToTime(cardConfig.start);
  const end = secondsToTime(cardConfig.end);

  // Setup temp paths
  const downloadedVideo = getTempPath(jobId, `segment_${cardIdx}.mp4`);
  const outputPath = getOutputPath(`${jobId}_${cardIdx}`, outputFormat);

  try {
    // Step 1: Download YouTube segment
    console.log(`[${jobId}] Downloading segment ${cardIdx}: ${start} - ${end}`);
    await downloadYouTubeSegment(url, start, end, downloadedVideo);

    // Step 2: Get video dimensions
    console.log(`[${jobId}] Getting video dimensions`);
    const { width, height } = await getVideoDimensions(downloadedVideo);

    // Step 3: Build crop filter
    const cropFilter = buildCropFilter(
      width,
      height,
      outputSize,
      cardConfig.video_position,
      cardConfig.video_scale
    );

    const filterChain = `${cropFilter}[scaled];[scaled][overlay]overlay=0:0`;

    if (cardConfig.type === 'video') {
      // Step 4: Encode video with overlay
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
        '-y', // Overwrite output file
        outputPath,
      ]);
    } else {
      // Step 5: Extract single frame with overlay
      console.log(`[${jobId}] Extracting frame for image card`);
      // Extract at 1 second or at a point 25% into the segment
      const duration = cardConfig.end - cardConfig.start;
      const seekTime = Math.min(1, duration * 0.25);

      await execFileAsync('ffmpeg', [
        '-ss', String(seekTime),
        '-i', downloadedVideo,
        '-i', overlayPath,
        '-vframes', '1',
        '-filter_complex', filterChain,
        '-y',
        outputPath,
      ]);
    }

    console.log(`[${jobId}] Card ${cardIdx} processed: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`[${jobId}] Error processing card ${cardIdx}:`, error.message);
    throw error;
  }
}
