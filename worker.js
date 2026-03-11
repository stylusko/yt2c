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
const workerConcurrency = Math.max(1, parseInt(process.env.WORKER_CONCURRENCY || '1', 10) || 1);

function saveOverlay(name, base64Data) {
  const dir = path.join(STORAGE_DIR, 'overlays');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Detect format from data URI prefix
  const isWebP = base64Data.startsWith('data:image/webp');
  const ext = isWebP ? 'webp' : 'png';
  const filePath = path.join(dir, `${name}.${ext}`);
  const data = base64Data.replace(/^data:image\/[a-z+]+;base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  return filePath;
}

function saveBackground(name, base64Data) {
  const dir = path.join(STORAGE_DIR, 'backgrounds');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  // Detect format from data URI prefix
  const isJpeg = base64Data.startsWith('data:image/jpeg') || base64Data.startsWith('data:image/jpg');
  const isWebP = base64Data.startsWith('data:image/webp');
  const ext = isWebP ? 'webp' : isJpeg ? 'jpg' : 'png';
  const filePath = path.join(dir, `${name}.${ext}`);
  const data = base64Data.replace(/^data:image\/[a-z+]+;base64,/, '');
  fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  return filePath;
}

// Dynamically import ESM modules
async function loadProcessCard() {
  const mod = await import('./lib/worker.js');
  return mod.processCard;
}

function detectCookieExpirySuspicion(errorMessage) {
  const msg = String(errorMessage || '').toLowerCase();
  if (!msg) return null;

  const patterns = [
    { re: /sign in to confirm your age|age-restricted|age restriction/, reason: '연령 제한/로그인 필요 문구 감지' },
    { re: /private video|members-only|join this channel|this video is available to this channel members/, reason: '로그인/권한 필요 영상 문구 감지' },
    { re: /cookies are no longer valid|cookie.*(?:expired|invalid|rejected)|session expired|authorization required/, reason: '쿠키/세션 만료 관련 문구 감지' },
    { re: /http error 403|forbidden/, reason: '403/Forbidden 반복' },
  ];

  for (const ptn of patterns) {
    if (ptn.re.test(msg)) return ptn.reason;
  }
  return null;
}

// Create worker
const worker = new Worker('video-generation', async (job) => {
  const { jobId, cardIdx, cardConfig, url, overlayData, backgroundData, outputFormat, outputSize } = job.data;
  const processCard = await loadProcessCard();

  console.log(`Processing job ${jobId}, card ${cardIdx}`);

  try {
    // Save overlay (10%)
    await job.updateProgress(10);
    console.log(`[${jobId}] Saving overlay for card ${cardIdx}`);
    const overlayPath = saveOverlay(`${jobId}_${cardIdx}`, overlayData);

    // Save background image if provided
    let backgroundPath = null;
    if (backgroundData) {
      console.log(`[${jobId}] Saving background image for card ${cardIdx}`);
      backgroundPath = saveBackground(`${jobId}_${cardIdx}`, backgroundData);
    }

    // Download segment (30%)
    await job.updateProgress(30);
    console.log(`[${jobId}] Starting ${backgroundPath ? 'image background' : 'download'} for card ${cardIdx}`);

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
        backgroundPath,
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
}, { connection, concurrency: workerConcurrency });

// Check if all jobs in a group are done and send group notification
async function checkGroupComplete(jobId, cardCount) {
  try {
    const t = await getTelegram();
    // Fetch by specific job ID pattern (deterministic, no scanning)
    const groupJobs = [];
    for (let i = 0; i < cardCount; i++) {
      const j = await queue.getJob(`${jobId}-${i}`);
      if (j) groupJobs.push(j);
    }
    const allDone = groupJobs.length === cardCount &&
      groupJobs.every(j => j.finishedOn || j.failedReason);

    if (!allDone) return;

    const completedJobs = groupJobs.filter(j => j.finishedOn && !j.failedReason);
    const failedJobs = groupJobs.filter(j => j.failedReason);
    const starts = groupJobs.map(j => j.processedOn).filter(Boolean);
    const ends = groupJobs.map(j => j.finishedOn).filter(Boolean);
    const totalDuration = starts.length && ends.length
      ? (Math.max(...ends) - Math.min(...starts)) / 1000
      : 0;
    const groupSample = groupJobs[0]?.data || {};
    const baseUrl = groupSample.baseUrl || process.env.APP_BASE_URL || 'https://youmeca.me';
    const projectUrl = groupSample.projectShareUrl || '';

    const completedCards = completedJobs
      .map((j) => ({
        cardIdx: j.data?.cardIdx,
        ext: j.data?.outputFormat || 'mp4',
        url: `${baseUrl}/api/jobs/${jobId}?download=true&cardIdx=${j.data?.cardIdx}&ext=${j.data?.outputFormat || 'mp4'}`,
      }))
      .filter((c) => Number.isInteger(c.cardIdx))
      .sort((a, b) => a.cardIdx - b.cardIdx);

    const failedCards = failedJobs
      .map((j) => ({
        cardIdx: j.data?.cardIdx,
        reason: String(j.failedReason || 'Unknown error').split('\n')[0].slice(0, 160),
      }))
      .filter((c) => Number.isInteger(c.cardIdx))
      .sort((a, b) => a.cardIdx - b.cardIdx);

    await t.notifyGroupComplete(jobId, completedJobs.length, failedJobs.length, totalDuration, {
      projectUrl,
      completedCards,
      failedCards,
    });
  } catch (err) {
    console.error('[telegram] checkGroupComplete error:', err.message);
  }
}

// Worker events
worker.on('completed', async (job) => {
  console.log(`Job ${job.id} completed`);
  try {
    const { jobId } = job.data;
    const t = await getTelegram();

    // Track stats
    const duration = job.finishedOn && job.processedOn
      ? (job.finishedOn - job.processedOn) / 1000
      : 0;
    await t.trackJob(jobId, 1, 'completed', duration);

    await checkGroupComplete(jobId, job.data.cardCount || 1);
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

    // Notify individual failure (include project URL for context)
    const projectUrl = job.data.projectShareUrl || '';
    await t.notifyJobFailed(jobId, cardIdx, err.message, { projectUrl });

    // Cookie/session expiry suspicion alert
    const suspicionReason = detectCookieExpirySuspicion(err.message);
    if (suspicionReason) {
      await t.notifyCookieExpirySuspected(jobId, cardIdx, suspicionReason);
    }

    // Check group completion (last job might be a failure)
    await checkGroupComplete(jobId, job.data.cardCount || 1);
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

console.log(`Video generation worker started (concurrency: ${workerConcurrency})`);
