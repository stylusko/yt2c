import fs from 'fs';
import path from 'path';

const STORAGE_DIR = process.env.STORAGE_DIR || '/tmp/yt2c-storage';
const OVERLAYS_DIR = path.join(STORAGE_DIR, 'overlays');
const OUTPUTS_DIR = path.join(STORAGE_DIR, 'outputs');
const TEMP_DIR = path.join(STORAGE_DIR, 'temp');

/**
 * Ensures all storage directories exist
 */
export function ensureStorageDir() {
  [STORAGE_DIR, OVERLAYS_DIR, OUTPUTS_DIR, TEMP_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Saves overlay PNG from base64 data
 * @param {string} jobId - Job ID
 * @param {string} base64Data - Base64-encoded PNG data
 * @returns {string} File path to saved overlay
 */
export function saveOverlay(jobId, base64Data) {
  ensureStorageDir();

  // Remove data URL prefix if present
  const data = base64Data.replace(/^data:image\/png;base64,/, '');
  const buffer = Buffer.from(data, 'base64');

  const overlayPath = path.join(OVERLAYS_DIR, `${jobId}.png`);
  fs.writeFileSync(overlayPath, buffer);

  return overlayPath;
}

/**
 * Gets output file path for a card
 * @param {string} jobId - Job ID
 * @param {string} ext - File extension (mp4, png, etc.)
 * @returns {string} File path
 */
export function getOutputPath(jobId, ext) {
  ensureStorageDir();
  return path.join(OUTPUTS_DIR, `${jobId}.${ext}`);
}

/**
 * Gets temporary file path for a job
 * @param {string} jobId - Job ID
 * @param {string} filename - Filename
 * @returns {string} File path
 */
export function getTempPath(jobId, filename) {
  ensureStorageDir();
  const jobTempDir = path.join(TEMP_DIR, jobId);
  if (!fs.existsSync(jobTempDir)) {
    fs.mkdirSync(jobTempDir, { recursive: true });
  }
  return path.join(jobTempDir, filename);
}

/**
 * Cleans up temporary files for a job
 * @param {string} jobId - Job ID
 */
export function cleanup(jobId) {
  const jobTempDir = path.join(TEMP_DIR, jobId);
  if (fs.existsSync(jobTempDir)) {
    fs.rmSync(jobTempDir, { recursive: true, force: true });
  }
}

/**
 * Gets output URL for a card (for downloading)
 * @param {string} jobId - Job ID
 * @param {string} ext - File extension
 * @returns {string} API URL
 */
export function getOutputUrl(jobId, ext) {
  return `/api/jobs/${jobId}?download=true&ext=${ext}`;
}
