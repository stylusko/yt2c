// POST /api/extract-article
// Body: { url?: string, rawText?: string, sourceUrl?: string }
// Response: { ok: true, article } | { ok: false, error, code }

import { extractFromUrl, extractFromText } from '../../lib/article-extractor.js';

export const config = {
  api: {
    bodyParser: { sizeLimit: '1mb' },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const { url, rawText, sourceUrl } = req.body || {};

    if (!url && !rawText) {
      return res.status(400).json({
        ok: false,
        error: 'url 또는 rawText 중 하나는 필수입니다.',
        code: 'MISSING_INPUT',
      });
    }

    let article;
    if (rawText) {
      article = extractFromText(rawText, { sourceUrl });
    } else {
      article = await extractFromUrl(url);
    }

    return res.status(200).json({ ok: true, article });
  } catch (err) {
    const code = err.code || 'EXTRACTION_FAILED';
    const status = code === 'INVALID_URL' || code === 'MISSING_INPUT' || code === 'EMPTY_BODY' || code === 'BODY_TOO_SHORT' ? 400 : 500;
    return res.status(status).json({
      ok: false,
      error: err.message || '알 수 없는 오류',
      code,
    });
  }
}
