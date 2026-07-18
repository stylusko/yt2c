const VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

function parseUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== 'https:' || parsed.port) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isYouTubeHost(value) {
  const parsed = parseUrl(value);
  return !!parsed && YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase());
}

export function extractYouTubeVideoId(value) {
  const parsed = parseUrl(value);
  if (!parsed) return null;

  const hostname = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(hostname)) return null;

  const segments = parsed.pathname.split('/').filter(Boolean);
  let candidate = null;

  if (hostname === 'youtu.be' || hostname === 'www.youtu.be') {
    candidate = segments[0];
  } else if (['shorts', 'embed', 'live'].includes(segments[0])) {
    candidate = segments[1];
  } else {
    candidate = parsed.searchParams.get('v');
  }

  return VIDEO_ID_RE.test(candidate || '') ? candidate : null;
}

export function validateYouTubeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return { ok: false, code: 'empty' };
  if (!/^https?:\/\//i.test(value.trim())) return { ok: false, code: 'format' };
  if (!parseUrl(value)) return { ok: false, code: 'format' };
  if (!isYouTubeHost(value)) return { ok: false, code: 'not_youtube' };
  if (!extractYouTubeVideoId(value)) return { ok: false, code: 'invalid_video' };
  return { ok: true };
}

export function toCanonicalYouTubeUrl(value) {
  const videoId = extractYouTubeVideoId(value);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}
