import { getVideoQueue } from '../../../lib/queue.js';
import { ensureStorageDir } from '../../../lib/storage.js';
import { v4 as uuidv4 } from 'uuid';
import { toCanonicalYouTubeUrl, validateYouTubeUrl } from '../../../lib/youtube-url.js';

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
    if (cards.length > 10) {
      return res.status(400).json({ error: '카드는 최대 10개까지 생성 가능합니다.' });
    }

    // Check if any card needs a YouTube video (no backgroundData)
    const hasVideoCard = cards.some(c => !c.backgroundData);

    // Validate URL only when at least one card needs video
    if (hasVideoCard) {
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL is required' });
      }
      const urlCheck = validateYouTubeUrl(url);
      if (!urlCheck.ok) {
        return res.status(400).json({ error: '올바른 YouTube 영상 또는 Shorts 링크를 입력해주세요.' });
      }
    }

    // Ensure storage directory exists
    ensureStorageDir();

    // Create job group ID
    const jobId = uuidv4();
    const queue = getVideoQueue();
    const baseUrl = getBaseUrl(req);

    // Validate: each card must have either a video URL or a background image
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      const cardUrl = c.cardConfig?.url || url || '';
      if (!c.backgroundData && !cardUrl) {
        return res.status(400).json({ error: `카드 ${i + 1}: 배경 이미지가 업로드되지 않았습니다.` });
      }
      if (!c.backgroundData && !validateYouTubeUrl(cardUrl).ok) {
        return res.status(400).json({ error: `카드 ${i + 1}: 올바른 YouTube 영상 또는 Shorts 링크를 입력해주세요.` });
      }
    }

    // Create one job per card
    const jobIds = [];
    for (let cardIdx = 0; cardIdx < cards.length; cardIdx++) {
      const { cardConfig, overlayData, backgroundData, bgSourceUrl } = cards[cardIdx];

      // Image-only cards always produce jpg, even if global outputFormat is 'video'
      const cardFormat = backgroundData
        ? 'jpg'
        : (outputFormat === 'video' ? 'mp4' : 'jpg');

      const jobData = {
        jobId,
        cardIdx,
        cardCount: cards.length,
        cardConfig: cardConfig || {},
        url: backgroundData ? '' : toCanonicalYouTubeUrl(cardConfig?.url || url || ''),
        overlayData: overlayData || '',
        backgroundData: backgroundData || '',
        bgSourceUrl: bgSourceUrl || '',
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
