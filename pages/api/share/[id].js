import { getSupabase } from '../../../lib/supabase';
import { getShareFromRedis } from '../../../lib/share-store';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('shared_projects')
        .select('data')
        .eq('id', id)
        .single();

      if (!error && data) return res.status(200).json({ data: data.data });
    } catch (error) {
      console.error('Supabase share read error:', error);
    }
  }

  try {
    const data = await getShareFromRedis(id);
    if (data) return res.status(200).json({ data });
  } catch (redisErr) {
    console.error('Redis share fallback read error:', redisErr);
  }

  return res.status(404).json({ error: 'Project not found' });
}
