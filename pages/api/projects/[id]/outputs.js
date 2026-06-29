import { getSupabase } from '../../../../lib/supabase';
import { requireAuth } from '../../../../lib/auth';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

function sanitizeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .filter(file => file && typeof file === 'object')
    .map((file, index) => {
      const bucketKey = String(file.bucketKey || '');
      const safeBucketKey = bucketKey.startsWith('cards/') && !bucketKey.includes('..') ? bucketKey : '';
      return {
        cardIdx: Number.isFinite(Number(file.cardIdx)) ? Number(file.cardIdx) : index,
        bucketKey: safeBucketKey,
        url: String(file.url || '').slice(0, 4096),
        ext: String(file.ext || '').slice(0, 12),
        fileName: String(file.fileName || '').slice(0, 160),
      };
    })
    .filter(file => file.bucketKey || file.url);
}

function outputRowToDto(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    outputType: row.output_type,
    status: row.status,
    title: row.title || '',
    thumbnailUrl: row.thumbnail_url || '',
    files: row.files || [],
    cardCount: row.card_count || 0,
    sourceHash: row.source_hash || '',
    createdAt: row.created_at,
  };
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Supabase is not configured' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id is required' });

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', user.id)
    .eq('id', id)
    .is('archived_at', null)
    .single();

  if (projectError || !project) return res.status(404).json({ error: 'Project not found' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('generated_outputs')
      .select('id,project_id,output_type,status,title,thumbnail_url,files,card_count,source_hash,created_at')
      .eq('user_id', user.id)
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ outputs: (data || []).map(outputRowToDto) });
  }

  if (req.method === 'POST') {
    const files = sanitizeFiles(req.body.files);
    if (files.length === 0) return res.status(400).json({ error: 'files are required' });

    const { data, error } = await supabase
      .from('generated_outputs')
      .insert({
        user_id: user.id,
        project_id: id,
        output_type: String(req.body.outputType || 'cards').slice(0, 40),
        status: String(req.body.status || 'completed').slice(0, 40),
        title: String(req.body.title || '').slice(0, 160),
        thumbnail_url: String(req.body.thumbnailUrl || '').slice(0, 2048),
        files,
        card_count: Number(req.body.cardCount) || files.length,
        source_hash: String(req.body.sourceHash || '').slice(0, 160),
      })
      .select('id,project_id,output_type,status,title,thumbnail_url,files,card_count,source_hash,created_at')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ output: outputRowToDto(data) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
