import { createClient } from '@supabase/supabase-js';

let supabase = null;

export function getSupabase() {
  if(process.env.YOUMECA_BACKEND==='firebase')return null;
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (url && key) {
    supabase = createClient(url, key);
  }
  return supabase;
}

export default getSupabase;
