import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAccessToken } from './session';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey
    ? 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set them in Vercel → Settings → Environment Variables, then redeploy.'
    : null;

function createSupabaseClient(): SupabaseClient {
  if (supabaseConfigError) {
    return createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  // Custom VTMS JWTs (not issued by Supabase Auth). The accessToken hook
  // attaches our JWT on every PostgREST/Storage request so RLS auth.uid() works,
  // without calling GoTrue getUser()/setSession (those reject custom tokens).
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    accessToken: async () => getAccessToken(),
  });
}

export const supabase = createSupabaseClient();

/** Keep for call-site compatibility — token is read live via accessToken hook. */
export async function setSupabaseAuthToken(_accessToken: string | null): Promise<void> {
  // no-op: getAccessToken() is the source of truth for Authorization headers
}
