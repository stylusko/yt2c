import { getSupabase } from './supabase.js';

export function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

export async function getAuthUser(req) {
  const token = getBearerToken(req);
  if (!token) return { user: null, error: 'missing_token', status: 401 };

  const supabase = getSupabase();
  if (!supabase) return { user: null, error: 'supabase_not_configured', status: 500 };

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { user: null, error: error?.message || 'invalid_token', status: 401 };
  }
  return { user: data.user, error: null, status: 200 };
}

export async function requireAuth(req, res) {
  const result = await getAuthUser(req);
  if (!result.user) {
    res.status(result.status || 401).json({ error: result.error || 'Unauthorized' });
    return null;
  }
  return result.user;
}
