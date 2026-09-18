import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ??
  '';

export const ADMIN_EMAIL =
  (import.meta.env.VITE_ADMIN_EMAIL as string | undefined) ?? 'admin@tmnaa.com';

// Never throw at module scope: a missing config must degrade to runtime
// failures (gallery/empty state), never a broken bundle (black screen).
export const supabase: SupabaseClient = (() => {
  if (!URL || !KEY) {
    console.warn(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.',
    );
    return createClient('https://placeholder.invalid', 'placeholder');
  }
  return createClient(URL, KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
})();