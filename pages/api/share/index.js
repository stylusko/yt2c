import crypto from 'crypto';
import { getSupabase } from '../../../lib/supabase';
import { saveShareToRedis } from '../../../lib/share-store';
import {firebaseBackend,signedInUser,legacyRef} from '../../../lib/firebase-runtime.mjs';
import {uploadedPayload} from '../../../lib/firebase-uploads.mjs';

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

  if(firebaseBackend()&&req.body?.uploadId) {
    try {const value=await uploadedPayload(req.body.uploadId,'share',signedInUser(req));await legacyRef('shares/'+req.body.uploadId).set({createdAt:Date.now(),bytes:value.bytes});return res.json({id:req.body.uploadId,storage:'firebase'});}
    catch {return res.status(400).json({error:'업로드 완료를 확인하지 못했습니다. 다시 시도해 주세요.'});}
  }
  const { data } = req.body;
  if (!data || typeof data !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid data' });
  }

  const id = crypto.randomBytes(4).toString('base64url');

  try {
    const saved = await saveShareToRedis(id, data);
    if (saved) return res.status(200).json({ id, storage: firebaseBackend()?'firebase':'redis' });
  } catch (redisErr) {
    console.error('Redis share save error:', redisErr);
  }

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
