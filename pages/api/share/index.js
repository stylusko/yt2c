import crypto from 'crypto';
import { getSupabase } from '../../../lib/supabase';
import { saveShareToRedis } from '../../../lib/share-store';
import { saveShareToPostgres } from '../../../lib/share-store-postgres.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { data } = req.body;
  if (!data || typeof data !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid data' });
  }

  const id = crypto.randomBytes(4).toString('base64url');
  let redisSaved = false;

  try {
    redisSaved = await saveShareToRedis(id, data);
  } catch (redisErr) {
    console.error('Redis share save error:', redisErr);
  }

  try {
    const saved = await saveShareToPostgres(id, data);
    if (saved) return res.status(200).json({ id, storage: 'postgres', cached: redisSaved });
  } catch (postgresErr) {
    console.error('Postgres share save error:', postgresErr);
  }

  if (redisSaved) return res.status(200).json({ id, storage: 'redis' });

  const supabase = getSupabase();

  if (supabase) {
    const { error } = await supabase
      .from('shared_projects')
      .insert({ id, data });

    if (!error) return res.status(200).json({ id });
    console.error('Supabase insert error:', error);
  }

  return res.status(500).json({ error: 'Failed to save project' });
}
