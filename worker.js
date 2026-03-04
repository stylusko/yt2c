const { Worker } = require('bullmq');
const path = require('path');
const fs = require('fs');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const STORAGE_DIR = process.env.STORAGE_DIR || '/tmp/yt2c-storage';

// Parse Redis URL
const redisConfig = new URL(redisUrl);
const connection = {
  host: redisConfig.hostname,
  port: parseInt(redisConfig.port || '6379'),
  ...(redisConfig.password && { password: redisConfig.password }),
  maxRetriesPerRequest: null,
};

function saveOverlay(name, base64Data) {
  const dir = path.join(STORAGE_DIR, 'overlays');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${name}.png`);
  const data = base64Data.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  return filePath;
}

// Dynamically import ESM modules
async function loadProcessCard() {
  const mod = await import('./lib/worker.js');
  return mod.processCard;
}

// Create worker
const worker = new Worker('video-generation', async (job) => {
  const { jobId, cardIdx, cardConfig, url, overlayData, outputFormat, outputSize } = job.data;
  const processCard = await loadProcessCard();

  console.log(`Processing job ${jobId}, card ${cardIdx}`);

  try {
    // Save overlay (10%)
    await job.updateProgress(10);
    console.log(`[${jobId}] Saving overlay for card ${cardIdx}`);
    const overlayPath = saveOverlay(`${jobId}_${cardIdx}`, overlayData);

    // Download segment (30%)
    await job.updateProgress(30);
    console.log(`[${jobId}] Starting download for card ${cardIdx}`);

    // Process card (80% during encoding)
    let progress = 30;
    const progressInterval = setInterval(async () => {
      progress = Math.min(progress + Math.random() * 15, 79);
      try { await job.updateProgress(Math.floor(progress)); } catch(e) {}
    }, 1000);

    try {
      await processCard({
        jobId,
        cardConfig,
        url,
        cardIdx,
        overlayPath,
        outputFormat: outputFormat || 'mp4',
        outputSize: outputSize || 1080,
      });
    } finally {
      clearInterval(progressInterval);
    }

    // Complete (100%)
    await job.updateProgress(100);
    console.log(`[${jobId}] Card ${cardIdx} completed`);

    return { cardIdx, status: 'completed' };
  } catch (error) {
    console.error(`[${jobId}] Error processing card ${cardIdx}:`, error.message);
    throw error;
  }
}, { connection, concurrency: 3 });

// Worker events
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err.message);
});

console.log('Video generation worker started (concurrency: 3)');
