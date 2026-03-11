import { getSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const { id } = req.query;

  const { data, error } = await supabase
    .from('shared_projects')
    .select('data')
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Project not found' });
  }

  return res.status(200).json({ data: data.data });
}
