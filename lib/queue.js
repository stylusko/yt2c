import { Queue, QueueEvents } from 'bullmq';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

function getRedisConnection() {
  const redisConfig = new URL(redisUrl);
  return {
    host: redisConfig.hostname,
    port: parseInt(redisConfig.port || '6379'),
    ...(redisConfig.password && { password: redisConfig.password }),
    maxRetriesPerRequest: null,
  };
}

// Lazy singleton queue instance
let _videoQueue = null;

export function getVideoQueue() {
  if (!_videoQueue) {
    _videoQueue = new Queue('video-generation', {
      connection: getRedisConnection(),
    });
  }
  return _videoQueue;
}

// Lazy singleton QueueEvents instance
let _queueEvents = null;

export function getQueueEvents() {
  if (!_queueEvents) {
    _queueEvents = new QueueEvents('video-generation', {
      connection: getRedisConnection(),
    });
  }
  return _queueEvents;
}
