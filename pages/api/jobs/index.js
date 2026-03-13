import { getVideoQueue } from '../../../lib/queue.js';
import { ensureStorageDir } from '../../../lib/storage.js';
import { v4 as uuidv4 } from 'uuid';

const YOUTUBE_HOST_RE = /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i;
const SHORTS_RE = /\/shorts\//i;

// Increase body size limit for overlay PNGs
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'youmeca.me';
  return `${proto}://${host}`;
}

/**
 * POST handler: Create new video generation jobs
 */
async function handlePost(req, res) {
  try {
    const { url, cards, outputFormat = 'video', outputSize = 1080, projectShareUrl = '' } = req.body;

    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'Cards array is required' });
    }

    // Check if any card needs a YouTube video (no backgroundData)
    const hasVideoCard = cards.some(c => !c.backgroundData);

    // Validate URL only when at least one card needs video
    if (hasVideoCard) {
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }
      if (!/^https?:\/\/.+/.test(url)) {
        return res.status(400).json({ error: 'Invalid URL format' });
      }
      if (!YOUTUBE_HOST_RE.test(url)) {
        return res.status(400).json({ error: '유튜브 링크만 지원합니다.' });
      }
      if (SHORTS_RE.test(url)) {
        return res.status(400).json({ error: '쇼츠(Shorts) 링크는 지원하지 않습니다.' });
      }
    }

    // Ensure storage directory exists
    ensureStorageDir();

    // Create job group ID
    const jobId = uuidv4();
    const queue = getVideoQueue();
    const baseUrl = getBaseUrl(req);

    // Create one job per card
    const jobIds = [];
    for (let cardIdx = 0; cardIdx < cards.length; cardIdx++) {
      const { cardConfig, overlayData, backgroundData } = cards[cardIdx];

      // Image-only cards always produce jpg, even if global outputFormat is 'video'
      const cardFormat = backgroundData
        ? 'jpg'
        : (outputFormat === 'video' ? 'mp4' : 'jpg');

      const jobData = {
        jobId,
        cardIdx,
        cardCount: cards.length,
        cardConfig: cardConfig || {},
        url: cardConfig?.url || url || '',
        overlayData: overlayData || '',
        backgroundData: backgroundData || '',
        outputFormat: cardFormat,
        outputSize,
        baseUrl,
        projectShareUrl,
      };

      const job = await queue.add(
        `video-${jobId}-${cardIdx}`,
        jobData,
        {
          jobId: `${jobId}-${cardIdx}`,
          attempts: 2,
          removeOnComplete: { age: 3600, count: 200 },
          removeOnFail: { age: 86400, count: 50 },
        }
      );

      jobIds.push(job.id);
    }

    return res.status(200).json({
      jobId,
      cardCount: cards.length,
      status: 'queued',
      jobIds,
    });
  } catch (error) {
    console.error('POST /api/jobs error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Main API handler
 */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    return handlePost(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
