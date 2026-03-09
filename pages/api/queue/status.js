import { getVideoQueue } from '../../../lib/queue.js';

const CONFIGURED_CONCURRENCY = Math.max(1, parseInt(process.env.WORKER_CONCURRENCY || '1', 10) || 1);

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function average(list) {
  if (!list.length) return 0;
  return list.reduce((sum, cur) => sum + cur, 0) / list.length;
}

function formatEtaSeconds(v) {
  return Math.max(0, Math.round(v));
}

async function getAvgSecondsPerCard(queue) {
  const completedJobs = await queue.getJobs(['completed'], 0, 49, false);
  const durations = completedJobs
    .map((job) => {
      if (!job?.processedOn || !job?.finishedOn) return null;
      const sec = (job.finishedOn - job.processedOn) / 1000;
      if (!Number.isFinite(sec) || sec <= 0) return null;
      return sec;
    })
    .filter(Boolean);

  return durations.length > 0 ? Math.round(average(durations)) : 0;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const queue = getVideoQueue();
    const { jobId } = req.query;

    const [waiting, active, delayed, avgSecondsPerCard] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getDelayedCount(),
      getAvgSecondsPerCard(queue),
    ]);

    const effectiveConcurrency = Math.max(CONFIGURED_CONCURRENCY, toNumber(active, 0), 1);
    const queueDepth = toNumber(waiting, 0) + toNumber(delayed, 0);
    const estimatedWaitSeconds = avgSecondsPerCard > 0
      ? formatEtaSeconds((queueDepth / effectiveConcurrency) * avgSecondsPerCard)
      : 0;

    const payload = {
      waiting: toNumber(waiting, 0),
      active: toNumber(active, 0),
      delayed: toNumber(delayed, 0),
      concurrency: CONFIGURED_CONCURRENCY,
      avgSecondsPerCard,
      estimatedWaitSeconds,
    };

    if (jobId && typeof jobId === 'string') {
      const allJobs = await queue.getJobs(['active', 'waiting', 'delayed', 'completed', 'failed']);
      const groupJobs = allJobs.filter((job) => job?.data?.jobId === jobId);

      if (groupJobs.length > 0) {
        const remainingCards = groupJobs.filter((job) => !job.finishedOn && !job.failedReason).length;
        payload.jobId = jobId;
        payload.remainingCards = remainingCards;
        payload.estimatedGroupSeconds = avgSecondsPerCard > 0
          ? formatEtaSeconds((remainingCards / effectiveConcurrency) * avgSecondsPerCard + estimatedWaitSeconds)
          : 0;
      }
    }

    return res.status(200).json(payload);
  } catch (error) {
    console.error('GET /api/queue/status error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
