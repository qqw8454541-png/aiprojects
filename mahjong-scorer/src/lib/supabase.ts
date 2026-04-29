import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  // 仅在浏览器端且确实缺失时警告
  if (typeof window !== 'undefined') {
    console.warn("Supabase credentials missing! Check your .env.local or Vercel Environment Variables.");
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
