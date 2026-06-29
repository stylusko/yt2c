import { fileExists, getDownloadUrl, deleteFile, getObject } from '../../lib/bucket.js';

function inferExt(key, ext) {
  if (ext) return String(ext).replace(/[^a-z0-9]/gi, '').toLowerCase();
  const match = String(key || '').match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : 'mp4';
}

function inferContentType(ext, fallback) {
  if (fallback) return fallback;
  if (ext === 'mp4') return 'video/mp4';
  if (ext === 'webm') return 'video/webm';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'zip') return 'application/zip';
  return 'application/octet-stream';
}

export default async function handler(req, res) {
  const { key, proxy, ext, filename } = req.query;

  if (!key) {
    return res.status(400).json({ error: 'key is required' });
  }

  // 보안: cards/ 접두사만 허용 + path traversal 방어
  if (!key.startsWith('cards/') || key.includes('..')) {
    return res.status(403).json({ error: 'Invalid key' });
  }

  if (req.method === 'GET') {
    try {
      const exists = await fileExists(key);
      if (!exists) {
        return res.status(404).json({ error: '파일을 찾을 수 없습니다' });
      }

      if (proxy === 'true' || proxy === '1') {
        const object = await getObject(key);
        if (!object?.Body) return res.status(404).json({ error: '파일을 찾을 수 없습니다' });

        const safeExt = inferExt(key, ext);
        const rawName = String(filename || `card.${safeExt}`);
        const safeName = rawName.replace(/[^\w.\-가-힣]/g, '_').slice(0, 160) || `card.${safeExt}`;
        res.setHeader('Content-Type', inferContentType(safeExt, object.ContentType));
        if (object.ContentLength) res.setHeader('Content-Length', object.ContentLength);
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}`);
        res.setHeader('Cache-Control', 'private, max-age=60');
        object.Body.pipe(res);
        object.Body.on('error', (error) => {
          console.error('Bucket proxy stream error:', error.message);
          if (!res.headersSent) res.status(500).json({ error: 'Failed to stream file' });
        });
        return;
      }

      const url = await getDownloadUrl(key);
      if (!url) {
        return res.status(500).json({ error: 'Failed to generate download URL' });
      }

      return res.status(200).json({ url });
    } catch (error) {
      console.error('GET /api/download error:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await deleteFile(key);
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('DELETE /api/download error:', error);
      return res.status(500).json({ error: error.message || 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
