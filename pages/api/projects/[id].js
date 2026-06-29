import { requireAuth } from '../../../lib/auth';
import { archiveProject, getProject, normalizePatchInput, updateProject } from '../../../lib/project-db.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id is required' });

  if (req.method === 'GET') {
    try {
      const project = await getProject(user.id, id);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      return res.status(200).json({ project });
    } catch (error) {
      console.error('[projects] get failed:', error.message);
      return res.status(500).json({ error: '프로젝트를 불러오지 못했어요.' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const project = await updateProject(user.id, id, normalizePatchInput(req.body));
      if (!project) return res.status(404).json({ error: 'Project not found' });
      return res.status(200).json({ project });
    } catch (error) {
      console.error('[projects] update failed:', error.message);
      return res.status(500).json({ error: '프로젝트를 저장하지 못했어요.' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const ok = await archiveProject(user.id, id);
      if (!ok) return res.status(404).json({ error: 'Project not found' });
      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error('[projects] archive failed:', error.message);
      return res.status(500).json({ error: '프로젝트를 삭제하지 못했어요.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
