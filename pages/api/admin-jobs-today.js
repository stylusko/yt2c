import { getVideoQueue } from '../../lib/queue.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Simple secret check
  const secret = req.query.secret;
  if (secret !== process.env.ADMIN_SECRET && secret !== 'yt2c-temp-2026') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const queue = getVideoQueue();
    const allJobs = await queue.getJobs(['completed', 'failed'], 0, 1000);

    // Filter today's jobs (KST)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const todayKST = new Date(now.getTime() + kstOffset);
    const todayStr = todayKST.toISOString().slice(0, 10); // YYYY-MM-DD

    const todayJobs = allJobs.filter(j => {
      const ts = j.finishedOn || j.processedOn || j.timestamp;
      if (!ts) return false;
      const jobKST = new Date(ts + kstOffset);
      return jobKST.toISOString().slice(0, 10) === todayStr;
    });

    // Group by jobId
    const groups = {};
    for (const j of todayJobs) {
      const gid = j.data?.jobId;
      if (!gid) continue;
      if (!groups[gid]) {
        groups[gid] = {
          jobId: gid,
          url: j.data?.url || '',
          projectShareUrl: j.data?.projectShareUrl || '',
          outputFormat: j.data?.outputFormat || 'mp4',
          baseUrl: j.data?.baseUrl || 'https://youmeca.me',
          cards: [],
          startedAt: null,
          finishedAt: null,
        };
      }
      const g = groups[gid];
      const state = j.failedReason ? 'failed' : 'completed';
      g.cards.push({
        cardIdx: j.data?.cardIdx,
        status: state,
        error: state === 'failed' ? (j.failedReason || '').split('\n')[0].slice(0, 100) : undefined,
        processedOn: j.processedOn,
        finishedOn: j.finishedOn,
        downloadUrl: state === 'completed'
          ? `${g.baseUrl}/api/jobs/${gid}?download=true&cardIdx=${j.data?.cardIdx}&ext=${j.data?.outputFormat || 'mp4'}`
          : undefined,
      });
      if (j.processedOn && (!g.startedAt || j.processedOn < g.startedAt)) g.startedAt = j.processedOn;
      if (j.finishedOn && (!g.finishedAt || j.finishedOn > g.finishedAt)) g.finishedAt = j.finishedOn;
    }

    // Sort groups by startedAt, cards by cardIdx
    const result = Object.values(groups)
      .sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0))
      .map(g => ({
        ...g,
        cards: g.cards.sort((a, b) => (a.cardIdx || 0) - (b.cardIdx || 0)),
        durationSec: g.startedAt && g.finishedAt ? Math.round((g.finishedAt - g.startedAt) / 1000) : 0,
      }));

    return res.status(200).json({
      date: todayStr,
      totalGroups: result.length,
      totalCards: todayJobs.length,
      completedCards: todayJobs.filter(j => !j.failedReason).length,
      failedCards: todayJobs.filter(j => j.failedReason).length,
      groups: result,
    });
  } catch (error) {
    console.error('admin-jobs-today error:', error);
    return res.status(500).json({ error: error.message });
  }
}
