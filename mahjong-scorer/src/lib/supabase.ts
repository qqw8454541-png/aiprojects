import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
  if (typeof window !== 'undefined') {
    console.warn("Supabase credentials missing! Check your .env.local or Vercel Environment Variables.");
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Auth-ready gate ─────────────────────────────────────────────
// Web 端的 RLS 策略依赖 auth.uid()，但 Supabase JS 客户端恢复 session
// 是异步的。此 Promise 确保所有数据查询等到 session 恢复完毕后再执行。
let _resolveAuthReady: () => void;
export const authReady = new Promise<void>((resolve) => {
  _resolveAuthReady = resolve;
});
/** 由 auth-store.ts 的 initialize() 在 getSession() 完成后调用 */
export function markAuthReady() {
  _resolveAuthReady();
}
