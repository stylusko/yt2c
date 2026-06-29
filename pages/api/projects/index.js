import { requireAuth } from '../../../lib/auth';
import { createProject, listProjects, normalizeProjectInput } from '../../../lib/project-db.js';

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

  if (req.method === 'GET') {
    try {
      const projects = await listProjects(user.id);
      return res.status(200).json({ projects });
    } catch (error) {
      console.error('[projects] list failed:', error.message);
      return res.status(500).json({ error: '프로젝트 목록을 불러오지 못했어요.' });
    }
  }

  if (req.method === 'POST') {
    const input = normalizeProjectInput(req.body);
    if (!input.latest_snapshot) return res.status(400).json({ error: 'snapshot is required' });

    try {
      const project = await createProject(user.id, input);
      return res.status(201).json({ project });
    } catch (error) {
      console.error('[projects] create failed:', error.message);
      return res.status(500).json({ error: '프로젝트를 저장하지 못했어요.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
