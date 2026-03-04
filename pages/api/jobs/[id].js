import fs from 'fs';
import path from 'path';
import { getVideoQueue } from '../../../lib/queue.js';
import { getOutputPath } from '../../../lib/storage.js';

/**
 * Streams a file to the client for download
 * @param {Object} res - Response object
 * @param {string} filePath - Path to file to download
 * @param {string} filename - Filename to use in download
 */
function streamFile(res, filePath, filename) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filename).toLowerCase();

  // Set appropriate content type
  let contentType = 'application/octet-stream';
  if (ext === '.mp4') {
    contentType = 'video/mp4';
  } else if (ext === '.png') {
    contentType = 'image/png';
  } else if (ext === '.jpg' || ext === '.jpeg') {
    contentType = 'image/jpeg';
  }

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', fileSize);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);

  stream.on('error', (err) => {
    console.error('Stream error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream file' });
    }
  });
}

/**
 * GET handler: Get job status or download output file
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
async function handleGet(req, res) {
  try {
    const { id } = req.query;
    const { download, cardIdx, ext } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const queue = getVideoQueue();

    // If download is requested
    if (download === 'true') {
      if (cardIdx === undefined) {
        return res.status(400).json({ error: 'cardIdx is required for download' });
      }

      const extension = ext || 'mp4';
      const filePath = getOutputPath(`${id}_${cardIdx}`, extension);
      const filename = `card-${cardIdx}.${extension}`;

      return streamFile(res, filePath, filename);
    }

    // Otherwise return job status
    const allJobs = await queue.getJobs();
    const groupJobs = allJobs.filter((job) => {
      const data = job.data || {};
      return data.jobId === id;
    });

    if (groupJobs.length === 0) {
      return res.status(404).json({ error: 'Job group not found' });
    }

    // Determine overall status
    let overallStatus = 'pending';
    let allCompleted = true;
    let anyFailed = false;

    for (const job of groupJobs) {
      const state = await job.getState();
      if (state === 'failed') {
        anyFailed = true;
        allCompleted = false;
      } else if (state !== 'completed') {
        allCompleted = false;
      }
    }

    if (anyFailed) {
      overallStatus = 'failed';
    } else if (allCompleted) {
      overallStatus = 'completed';
    } else {
      overallStatus = 'processing';
    }

    // Build card status array
    const cards = await Promise.all(
      groupJobs.map(async (job) => {
        const cardIdx = job.data.cardIdx;
        const state = await job.getState();
        const progress = job.progress();

        return {
          cardIdx,
          status: state || 'pending',
          progress: typeof progress === 'number' ? progress : 0,
          outputUrl: `/api/jobs/${id}?download=true&cardIdx=${cardIdx}&ext=${job.data.outputFormat || 'mp4'}`,
        };
      })
    );

    return res.status(200).json({
      jobId: id,
      status: overallStatus,
      cardCount: cards.length,
      cards: cards.sort((a, b) => a.cardIdx - b.cardIdx),
    });
  } catch (error) {
    console.error('GET /api/jobs/[id] error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Main API handler
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
