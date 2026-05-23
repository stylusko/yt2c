import crypto from 'crypto';
import { getSupabase } from '../../../lib/supabase';
import { saveShareToRedis } from '../../../lib/share-store';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data } = req.body;
  if (!data || typeof data !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid data' });
  }

  const id = crypto.randomBytes(4).toString('base64url');
  const supabase = getSupabase();

  if (supabase) {
    const { error } = await supabase
      .from('shared_projects')
      .insert({ id, data });

    if (!error) return res.status(200).json({ id });
    console.error('Supabase insert error:', error);
  }

  try {
    const saved = await saveShareToRedis(id, data);
    if (saved) return res.status(200).json({ id, fallback: 'redis' });
  } catch (redisErr) {
    console.error('Redis share fallback error:', redisErr);
  }

  return res.status(500).json({ error: 'Failed to save project' });
}
