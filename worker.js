const { Worker, Queue } = require('bullmq');
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

// Dynamically import ESM telegram module
let tg = null;
async function getTelegram() {
  if (!tg) tg = await import('./lib/telegram.js');
  return tg;
}

// Queue instance for checking job group status
const queue = new Queue('video-generation', { connection });

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
worker.on('completed', async (job) => {
  console.log(`Job ${job.id} completed`);
  try {
    const { jobId, cardIdx } = job.data;
    const t = await getTelegram();

    // Track stats
    const duration = job.finishedOn && job.processedOn
      ? (job.finishedOn - job.processedOn) / 1000
      : 0;
    await t.trackJob(jobId, 1, 'completed', duration);

    // Check if all jobs in this group are done
    const allJobs = await queue.getJobs(['completed', 'active', 'waiting', 'failed']);
    const groupJobs = allJobs.filter(j => j.data?.jobId === jobId);
    const allDone = groupJobs.every(j => j.finishedOn || j.failedReason);

    if (allDone && groupJobs.length > 0) {
      const completedJobs = groupJobs.filter(j => j.finishedOn && !j.failedReason);
      const failedJobs = groupJobs.filter(j => j.failedReason);
      // Total duration from first processedOn to last finishedOn
      const starts = groupJobs.map(j => j.processedOn).filter(Boolean);
      const ends = groupJobs.map(j => j.finishedOn).filter(Boolean);
      const totalDuration = starts.length && ends.length
        ? (Math.max(...ends) - Math.min(...starts)) / 1000
        : 0;
      await t.notifyGroupComplete(jobId, completedJobs.length, failedJobs.length, totalDuration);
    }
  } catch (err) {
    console.error('[telegram] completed hook error:', err.message);
  }
});

worker.on('failed', async (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
  try {
    const { jobId, cardIdx } = job.data;
    const t = await getTelegram();

    // Track stats
    await t.trackJob(jobId, 0, 'failed');

    // Notify failure
    await t.notifyJobFailed(jobId, cardIdx, err.message);

    // Check for low resolution indicator (cookie expiry)
    if (err.message && err.message.includes('640')) {
      await t.notifyLowResolution(jobId, 640, 360);
    }
  } catch (e) {
    console.error('[telegram] failed hook error:', e.message);
  }
});

worker.on('error', (err) => {
  console.error('Worker error:', err.message);
});

// Worker start notification
(async () => {
  try {
    const t = await getTelegram();
    await t.notifyWorkerStart();
  } catch (err) {
    console.error('[telegram] worker start notification error:', err.message);
  }
})();

// Daily report cron (KST 00:00)
function scheduleDailyReport() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const tomorrow = new Date(kst);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const msUntilMidnight = tomorrow.getTime() - kst.getTime();

  console.log(`[telegram] Daily report scheduled in ${Math.round(msUntilMidnight / 60000)}min`);

  setTimeout(async () => {
    try {
      const t = await getTelegram();
      await t.sendDailyReport();
    } catch (err) {
      console.error('[telegram] daily report error:', err.message);
    }
    // Then repeat every 24h
    setInterval(async () => {
      try {
        const t = await getTelegram();
        await t.sendDailyReport();
      } catch (err) {
        console.error('[telegram] daily report error:', err.message);
      }
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

scheduleDailyReport();

console.log('Video generation worker started (concurrency: 3)');
