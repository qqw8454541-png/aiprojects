import { createClient } from '@supabase/supabase-js';

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const useProxy = process.env.NEXT_PUBLIC_USE_SUPABASE_PROXY === 'true';

// In local dev the browser can't reach the local Supabase directly, so we
// proxy through the Next.js server via rewrites (see next.config.ts).
// In production, SUPABASE_LOCAL_PROXY is unset — use the env URL directly.
const supabaseUrl =
  typeof window !== 'undefined' && useProxy
    ? `${window.location.origin}/supabase-proxy`
    : envUrl;

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.warn("Supabase credentials missing! Check your .env.local or Vercel Environment Variables.");
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

