import { getSupabase } from '../../../lib/supabase';
import { getShareFromRedis } from '../../../lib/share-store';
import { getShareFromPostgres } from '../../../lib/share-store-postgres.js';

export const config = {
  api: {
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  try {
    const data = await getShareFromRedis(id);
    if (data) return res.status(200).json({ data, storage: 'redis' });
  } catch (redisErr) {
    console.error('Redis share read error:', redisErr);
  }

  try {
    const data = await getShareFromPostgres(id);
    if (data) return res.status(200).json({ data, storage: 'postgres' });
  } catch (postgresErr) {
    console.error('Postgres share read error:', postgresErr);
  }

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

  return res.status(404).json({ error: 'Project not found' });
}
