import { supabase } from '../lib/supabase';

export function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  return supabase;
}
