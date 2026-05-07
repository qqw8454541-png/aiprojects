import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.warn("Supabase credentials missing! Check your .env.local or Vercel Environment Variables.");
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

