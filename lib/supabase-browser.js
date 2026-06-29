import { createClient } from '@supabase/supabase-js';

let browserSupabase = null;

export function getBrowserSupabase() {
  if (typeof window === 'undefined') return null;
  if (browserSupabase) return browserSupabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  browserSupabase = createClient(url, key);
  return browserSupabase;
}

export default getBrowserSupabase;
