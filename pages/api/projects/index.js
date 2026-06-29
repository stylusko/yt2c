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

function normalizeProjectInput(body = {}) {
  const snapshot = body.snapshot && typeof body.snapshot === 'object' ? body.snapshot : null;
  const title = String(body.title || snapshot?.name || '새 프로젝트').trim().slice(0, 120) || '새 프로젝트';
  const cards = Array.isArray(snapshot?.cards) ? snapshot.cards : [];
  const sourceType = String(body.sourceType || snapshot?.sourceType || 'youtube').slice(0, 40);
  const pageVariant = String(body.pageVariant || snapshot?.pageVariant || 'default').slice(0, 40);
  return {
    title,
    project_type: String(body.projectType || (sourceType === 'article' ? 'text' : 'video')).slice(0, 40),
    source_type: sourceType,
    brand: String(body.brand || (pageVariant === 'bmonly' ? 'baemin-only' : '')).slice(0, 80),
    page_variant: pageVariant,
    thumbnail_url: String(body.thumbnailUrl || '').slice(0, 2048),
    card_count: Number.isFinite(Number(body.cardCount)) ? Number(body.cardCount) : cards.length,
    latest_snapshot: snapshot,
  };
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;

  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Supabase is not configured' });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('projects')
      .select('id,title,project_type,source_type,brand,page_variant,thumbnail_url,card_count,created_at,updated_at')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ projects: (data || []).map(row => projectRowToDto(row)) });
  }

  if (req.method === 'POST') {
    const input = normalizeProjectInput(req.body);
    if (!input.latest_snapshot) return res.status(400).json({ error: 'snapshot is required' });

    const { data, error } = await supabase
      .from('projects')
      .insert({ ...input, user_id: user.id })
      .select('id,title,project_type,source_type,brand,page_variant,thumbnail_url,card_count,created_at,updated_at,latest_snapshot')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ project: projectRowToDto(data, true) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
