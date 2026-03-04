import { getVideoQueue } from '../../../lib/queue.js';
import { saveOverlay, ensureStorageDir } from '../../../lib/storage.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Validates card configuration
 * @param {Object} card - Card configuration
 * @throws {Error} If validation fails
 */
function validateCard(card) {
  if (typeof card.start !== 'number' || card.start < 0) {
    throw new Error('Card start time must be a non-negative number');
  }
  if (typeof card.end !== 'number' || card.end <= card.start) {
    throw new Error('Card end time must be greater than start time');
  }
  if (!card.type || !['video', 'image'].includes(card.type)) {
    throw new Error('Card type must be "video" or "image"');
  }
  if (!Array.isArray(card.video_position) || card.video_position.length !== 2) {
    throw new Error('Card video_position must be an array of [x, y]');
  }
  if (typeof card.video_scale !== 'number' || card.video_scale < 100) {
    throw new Error('Card video_scale must be a number >= 100');
  }
}

/**
 * POST handler: Create new video generation jobs
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function handlePost(req, res) {
  try {
    const { url, cards, outputFormat = 'mp4', outputSize = 1080, overlays } = req.body;

    // Validate input
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required and must be a string' });
    }

    if (!Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'Cards array is required and must not be empty' });
    }

    if (!Array.isArray(overlays) || overlays.length !== cards.length) {
      return res.status(400).json({
        error: `Number of overlays (${overlays.length}) must match number of cards (${cards.length})`,
      });
    }

    // Validate each card
    for (let i = 0; i < cards.length; i++) {
      try {
        validateCard(cards[i]);
      } catch (error) {
        return res.status(400).json({
          error: `Card ${i} validation failed: ${error.message}`,
        });
      }
    }

    // Ensure storage directory exists
    ensureStorageDir();

    // Create job group ID
    const jobId = uuidv4();
    const queue = getVideoQueue();

    // Create one job per card
    const jobIds = [];
    for (let cardIdx = 0; cardIdx < cards.length; cardIdx++) {
      const jobData = {
        jobId,
        cardIdx,
        cardConfig: cards[cardIdx],
        url,
        overlayData: overlays[cardIdx],
        outputFormat,
        outputSize,
      };

      const job = await queue.add(
        `video-${jobId}-${cardIdx}`,
        jobData,
        {
          jobId: `${jobId}-${cardIdx}`,
          attempts: 1,
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
    console.error('POST /api/jobs error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET handler: Get status of jobs in a group
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function handleGet(req, res) {
  try {
    const { jobId } = req.query;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId query parameter is required' });
    }

    const queue = getVideoQueue();
    const allJobs = await queue.getJobs();

    // Filter jobs by group ID
    const groupJobs = allJobs.filter((job) => {
      const data = job.data || {};
      return data.jobId === jobId;
    });

    if (groupJobs.length === 0) {
      return res.status(404).json({ error: 'Job group not found' });
    }

    // Build response with card statuses
    const cards = await Promise.all(
      groupJobs.map(async (job) => {
        const cardIdx = job.data.cardIdx;
        const state = await job.getState();
        const progress = job.progress();

        return {
          cardIdx,
          status: state || 'unknown',
          progress: typeof progress === 'number' ? progress : 0,
          outputUrl: `/api/jobs/${jobId}?download=true&cardIdx=${cardIdx}`,
        };
      })
    );

    return res.status(200).json({
      jobId,
      cardCount: cards.length,
      cards: cards.sort((a, b) => a.cardIdx - b.cardIdx),
    });
  } catch (error) {
    console.error('GET /api/jobs error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Main API handler
 */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    return handlePost(req, res);
  } else if (req.method === 'GET') {
    return handleGet(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
