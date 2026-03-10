import { Queue } from 'bullmq';
import { notifyGroupComplete } from '../lib/telegram.js';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const replayHours = Math.max(1, parseInt(process.env.REPLAY_HOURS || '48', 10) || 48);
const dryRun = process.env.DRY_RUN === '1';

function getRedisConnection() {
  const redisConfig = new URL(redisUrl);
  return {
    host: redisConfig.hostname,
    port: parseInt(redisConfig.port || '6379', 10),
    ...(redisConfig.password && { password: redisConfig.password }),
    maxRetriesPerRequest: null,
  };
}

function summarizeFailedReason(reason) {
  return String(reason || 'Unknown error').split('\n')[0].slice(0, 160);
}

async function main() {
  const connection = getRedisConnection();
  const queue = new Queue('video-generation', { connection });

  try {
    const cutoffTs = Date.now() - replayHours * 60 * 60 * 1000;
    const jobs = await queue.getJobs(['completed', 'failed'], 0, -1, false);

    const groups = new Map();
    for (const job of jobs) {
      const groupId = job?.data?.jobId;
      if (!groupId) continue;
      if (!groups.has(groupId)) groups.set(groupId, []);
      groups.get(groupId).push(job);
    }

    let candidateGroups = 0;
    let notifiedGroups = 0;

    for (const [jobId, groupJobs] of groups.entries()) {
      const latestTs = Math.max(...groupJobs.map((j) => j.finishedOn || j.processedOn || 0));
      if (latestTs < cutoffTs) continue;

      const allDone = groupJobs.every((j) => j.finishedOn || j.failedReason);
      if (!allDone) continue;

      candidateGroups += 1;

      const completedJobs = groupJobs.filter((j) => j.finishedOn && !j.failedReason);
      const failedJobs = groupJobs.filter((j) => j.failedReason);

      const starts = groupJobs.map((j) => j.processedOn).filter(Boolean);
      const ends = groupJobs.map((j) => j.finishedOn).filter(Boolean);
      const totalDuration = starts.length && ends.length
        ? (Math.max(...ends) - Math.min(...starts)) / 1000
        : 0;

      const sample = groupJobs[0]?.data || {};
      const baseUrl = sample.baseUrl || process.env.APP_BASE_URL || 'https://youmeca.me';
      const projectUrl = sample.projectShareUrl || '';

      const completedCards = completedJobs
        .map((j) => ({
          cardIdx: j.data?.cardIdx,
          url: `${baseUrl}/api/jobs/${jobId}?download=true&cardIdx=${j.data?.cardIdx}&ext=${j.data?.outputFormat || 'mp4'}`,
        }))
        .filter((c) => Number.isInteger(c.cardIdx))
        .sort((a, b) => a.cardIdx - b.cardIdx);

      const failedCards = failedJobs
        .map((j) => ({
          cardIdx: j.data?.cardIdx,
          reason: summarizeFailedReason(j.failedReason),
        }))
        .filter((c) => Number.isInteger(c.cardIdx))
        .sort((a, b) => a.cardIdx - b.cardIdx);

      if (dryRun) {
        console.log(`[dry-run] notify ${jobId} completed=${completedCards.length} failed=${failedCards.length}`);
        continue;
      }

      await notifyGroupComplete(jobId, completedJobs.length, failedJobs.length, totalDuration, {
        projectUrl,
        completedCards,
        failedCards,
      });
      notifiedGroups += 1;
    }

    console.log(`Replay scan finished: candidates=${candidateGroups}, notified=${dryRun ? 0 : notifiedGroups}, dryRun=${dryRun}`);
  } finally {
    await queue.close();
  }
}

main().catch((err) => {
  console.error('replay-telegram-48h failed:', err);
  process.exit(1);
});
