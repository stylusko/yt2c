import { fileExists, getDownloadUrl, deleteFile } from '../../lib/bucket.js';

export default async function handler(req, res) {
  const { key } = req.query;

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
