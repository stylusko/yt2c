import crypto from 'crypto';
import { getSupabase } from '../../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' });
  }

  const { data } = req.body;
  if (!data || typeof data !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid data' });
  }

  const id = crypto.randomBytes(4).toString('base64url');

  const { error } = await supabase
    .from('shared_projects')
    .insert({ id, data });

  if (error) {
    console.error('Supabase insert error:', error);
    return res.status(500).json({ error: 'Failed to save project' });
  }

  return res.status(200).json({ id });
}
