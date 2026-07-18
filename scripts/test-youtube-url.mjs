import assert from 'node:assert/strict';
import {
  extractYouTubeVideoId,
  isYouTubeHost,
  toCanonicalYouTubeUrl,
  validateYouTubeUrl,
} from '../lib/youtube-url.js';

const videoId = 'dQw4w9WgXcQ';

assert.equal(extractYouTubeVideoId(`https://www.youtube.com/watch?v=${videoId}`), videoId);
assert.equal(extractYouTubeVideoId(`https://youtu.be/${videoId}?si=share-token`), videoId);
assert.equal(extractYouTubeVideoId(`https://www.youtube.com/shorts/${videoId}?feature=share`), videoId);
assert.equal(extractYouTubeVideoId(`https://m.youtube.com/shorts/${videoId}`), videoId);
assert.equal(extractYouTubeVideoId(`https://www.youtube.com/embed/${videoId}`), videoId);
assert.equal(extractYouTubeVideoId(`https://www.youtube.com/live/${videoId}`), videoId);

assert.deepEqual(validateYouTubeUrl(`https://www.youtube.com/shorts/${videoId}`), { ok: true });
assert.deepEqual(validateYouTubeUrl('youtube.com/shorts/dQw4w9WgXcQ'), { ok: false, code: 'format' });
assert.deepEqual(validateYouTubeUrl('https://www.youtube.com/shorts/too-short'), { ok: false, code: 'invalid_video' });
assert.deepEqual(validateYouTubeUrl('https://example.com/watch?v=dQw4w9WgXcQ'), { ok: false, code: 'not_youtube' });
assert.equal(isYouTubeHost(`https://www.youtube-nocookie.com/embed/${videoId}`), false);
assert.equal(extractYouTubeVideoId(`https://www.youtube-nocookie.com/embed/${videoId}`), null);
assert.deepEqual(validateYouTubeUrl(`http://www.youtube.com/watch?v=${videoId}`), { ok: false, code: 'format' });
assert.deepEqual(validateYouTubeUrl(`https://www.youtube.com:4444/watch?v=${videoId}`), { ok: false, code: 'format' });
assert.equal(toCanonicalYouTubeUrl(`https://www.youtube.com/shorts/${videoId}/extra?feature=share`), `https://www.youtube.com/watch?v=${videoId}`);
assert.equal(toCanonicalYouTubeUrl('http://127.0.0.1/internal'), null);

const { default: aiEditHandler } = await import('../pages/api/ai-edit.js');
let apiStatus = 200;
let apiBody = null;
const apiResponse = {
  status(code) { apiStatus = code; return this; },
  json(body) { apiBody = body; return this; },
};
await aiEditHandler({ method: 'GET', query: { url: 'http://127.0.0.1/internal' } }, apiResponse);
assert.equal(apiStatus, 400);
assert.match(apiBody?.error || '', /YouTube/);

console.log('youtube URL tests passed');
