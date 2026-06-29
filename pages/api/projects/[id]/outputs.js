import { requireAuth } from '../../../../lib/auth';
import { createOutput, ensureProjectOwner, listOutputs, sanitizeOutputFiles } from '../../../../lib/project-db.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id is required' });

  try {
    const ownsProject = await ensureProjectOwner(user.id, id);
    if (!ownsProject) return res.status(404).json({ error: 'Project not found' });

    if (req.method === 'GET') {
      const outputs = await listOutputs(user.id, id);
      return res.status(200).json({ outputs });
    }

    if (req.method === 'POST') {
      const files = sanitizeOutputFiles(req.body.files);
      if (files.length === 0) return res.status(400).json({ error: 'files are required' });
      const output = await createOutput(user.id, id, req.body, files);
      return res.status(201).json({ output });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[outputs] request failed:', error.message);
    return res.status(500).json({ error: '생성 결과물을 처리하지 못했어요.' });
  }
}
