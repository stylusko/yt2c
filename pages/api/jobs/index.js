import { getVideoQueue } from '../../../lib/queue.js';
import { ensureStorageDir } from '../../../lib/storage.js';
import { v4 as uuidv4 } from 'uuid';

// Increase body size limit for overlay PNGs
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

/**
 * POST handler: Create new video generation jobs
 */
async function handlePost(req, res) {
  try {
    const { url, cards, outputFormat = 'video', outputSize = 1080 } = req.body;

    // Validate input
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'Cards array is required' });
    }

    // Ensure storage directory exists
    ensureStorageDir();

    // Create job group ID
    const jobId = uuidv4();
    const queue = getVideoQueue();

    // Create one job per card
    const jobIds = [];
    for (let cardIdx = 0; cardIdx < cards.length; cardIdx++) {
      const { cardConfig, overlayData } = cards[cardIdx];

      const jobData = {
        jobId,
        cardIdx,
        cardConfig: cardConfig || {},
        url: cardConfig?.url || url,
        overlayData: overlayData || '',
        outputFormat: outputFormat === 'video' ? 'mp4' : 'jpg',
        outputSize,
      };

      const job = await queue.add(
        `video-${jobId}-${cardIdx}`,
        jobData,
        {
          jobId: `${jobId}-${cardIdx}`,
          attempts: 2,
          removeOnComplete: false,
          removeOnFailed: false,
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
