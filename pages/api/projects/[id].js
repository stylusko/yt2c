import { getSupabase } from '../../../lib/supabase';
import { requireAuth } from '../../../lib/auth';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

function projectRowToDto(row, includeSnapshot = false) {
  if (!row) return null;
  const dto = {
    id: row.id,
    title: row.title,
    projectType: row.project_type || 'video',
    sourceType: row.source_type || 'youtube',
    brand: row.brand || '',
    pageVariant: row.page_variant || 'default',
    thumbnailUrl: row.thumbnail_url || '',
    cardCount: row.card_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includeSnapshot) dto.snapshot = row.latest_snapshot || null;
  return dto;
}

function normalizePatchInput(body = {}) {
  const patch = {};
  if (body.title !== undefined) patch.title = String(body.title || '새 프로젝트').trim().slice(0, 120) || '새 프로젝트';
  if (body.projectType !== undefined) patch.project_type = String(body.projectType || 'video').slice(0, 40);
  if (body.sourceType !== undefined) patch.source_type = String(body.sourceType || 'youtube').slice(0, 40);
  if (body.brand !== undefined) patch.brand = String(body.brand || '').slice(0, 80);
  if (body.pageVariant !== undefined) patch.page_variant = String(body.pageVariant || 'default').slice(0, 40);
  if (body.thumbnailUrl !== undefined) patch.thumbnail_url = String(body.thumbnailUrl || '').slice(0, 2048);
  if (body.cardCount !== undefined) patch.card_count = Number(body.cardCount) || 0;
  if (body.snapshot && typeof body.snapshot === 'object') {
    patch.latest_snapshot = body.snapshot;
    if (patch.card_count === undefined) patch.card_count = Array.isArray(body.snapshot.cards) ? body.snapshot.cards.length : 0;
    if (patch.title === undefined) patch.title = String(body.snapshot.name || '새 프로젝트').trim().slice(0, 120) || '새 프로젝트';
    if (patch.source_type === undefined) patch.source_type = String(body.snapshot.sourceType || 'youtube').slice(0, 40);
  }
  patch.updated_at = new Date().toISOString();
  return patch;
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Supabase is not configured' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id is required' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('projects')
      .select('id,title,project_type,source_type,brand,page_variant,thumbnail_url,card_count,created_at,updated_at,latest_snapshot')
      .eq('user_id', user.id)
      .eq('id', id)
      .is('archived_at', null)
      .single();

    if (error || !data) return res.status(404).json({ error: error?.message || 'Project not found' });
    return res.status(200).json({ project: projectRowToDto(data, true) });
  }

  if (req.method === 'PATCH') {
    const patch = normalizePatchInput(req.body);
    const { data, error } = await supabase
      .from('projects')
      .update(patch)
      .eq('user_id', user.id)
      .eq('id', id)
      .is('archived_at', null)
      .select('id,title,project_type,source_type,brand,page_variant,thumbnail_url,card_count,created_at,updated_at,latest_snapshot')
      .single();

    if (error || !data) return res.status(404).json({ error: error?.message || 'Project not found' });
    return res.status(200).json({ project: projectRowToDto(data, true) });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('projects')
      .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
