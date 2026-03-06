import fs from 'fs';
import path from 'path';
import { getVideoQueue } from '../../../lib/queue.js';

const STORAGE_DIR = process.env.STORAGE_DIR || '/tmp/yt2c-storage';

/**
 * GET handler: Get job status or download output file
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
      const filePath = path.join(STORAGE_DIR, 'outputs', `${id}_${cardIdx}.${extension}`);
      const filename = `card-${parseInt(cardIdx) + 1}.${extension}`;

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      const stat = fs.statSync(filePath);
      let contentType = 'application/octet-stream';
      if (extension === 'mp4') contentType = 'video/mp4';
      else if (extension === 'png') contentType = 'image/png';
      else if (extension === 'jpg' || extension === 'jpeg') contentType = 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stat.size);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      stream.on('error', (err) => {
        console.error('Stream error:', err.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to stream file' });
        }
      });
      return;
    }

    // Otherwise return job status
    const allJobs = await queue.getJobs(['active', 'waiting', 'completed', 'failed', 'delayed']);
    const groupJobs = allJobs.filter((job) => {
      return job?.data?.jobId === id;
    });

    if (groupJobs.length === 0) {
      return res.status(404).json({ error: 'Job group not found' });
    }

    // Build card status array
    const cards = await Promise.all(
      groupJobs.map(async (job) => {
        const cardIdx = job.data.cardIdx;
        const state = await job.getState();
        const progress = job.progress;
        const ext = job.data.outputFormat || 'mp4';

        const result = {
          cardIdx,
          status: state || 'pending',
          progress: typeof progress === 'number' ? progress : 0,
        };

        if (state === 'completed') {
          result.downloadUrl = `/api/jobs/${id}?download=true&cardIdx=${cardIdx}&ext=${ext}`;
        }

        if (state === 'failed') {
          result.error = job.failedReason || 'Unknown error';
        }

        return result;
      })
    );

    return res.status(200).json({
      jobId: id,
      cardCount: cards.length,
      cards: cards.sort((a, b) => a.cardIdx - b.cardIdx),
    });
  } catch (error) {
    console.error('GET /api/jobs/[id] error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * DELETE handler: Cancel/remove all jobs in a job group
 */
async function handleDelete(req, res) {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Job ID is required' });

    const queue = getVideoQueue();
    const allJobs = await queue.getJobs(['active', 'waiting', 'completed', 'failed', 'delayed']);
    const groupJobs = allJobs.filter((job) => job?.data?.jobId === id);

    let cancelled = 0;
    for (const job of groupJobs) {
      const state = await job.getState();
      if (state === 'active') {
        await job.moveToFailed(new Error('Cancelled by user'), true);
        cancelled++;
      } else if (state === 'waiting' || state === 'delayed') {
        await job.remove();
        cancelled++;
      }
    }

    return res.status(200).json({ jobId: id, cancelled });
  } catch (error) {
    console.error('DELETE /api/jobs/[id] error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return handleGet(req, res);
  } else if (req.method === 'DELETE') {
    return handleDelete(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
