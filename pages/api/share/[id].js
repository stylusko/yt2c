import { getSupabase } from '../../../lib/supabase';
import { getShareFromRedis } from '../../../lib/share-store';
import {legacyShare} from '../../../lib/legacy-archive.mjs';

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
    const data = await legacyShare(id);
    if (data) return res.status(200).json({data, storage: 'preserved-archive'});
  } catch {
    return res.status(503).json({error: '기존 프로젝트 보관본을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.'});
  }
  return res.status(404).json({ error: 'Project not found' });
}
