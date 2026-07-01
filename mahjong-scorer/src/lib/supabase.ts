import { createClient } from '@supabase/supabase-js';
import { TIMING } from './session-policy';

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

// ── Session recovery utilities ──────────────────────────────────

/**
 * 主动刷新 Supabase auth session (JWT)。
 * 用于页面唤醒时恢复过期的 token。
 *
 * @returns true 如果刷新成功或无需刷新（匿名用户）
 */
export async function refreshSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('[supabase] getSession failed:', error.message);
      return false;
    }
    // 无 session = 匿名用户，不需要刷新
    if (!data.session) return true;

    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.warn('[supabase] refreshSession failed:', refreshError.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[supabase] refreshSession unexpected error:', err);
    return false;
  }
}

/**
 * 轻量级数据库连通性检查。
 * 用一个极小的查询验证 PostgREST 可达且 JWT 有效。
 *
 * @returns true 如果连接正常
 */
export async function pingDatabase(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMING.PING_TIMEOUT_MS);
    const { error } = await supabase
      .from('user_devices')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal)
      .maybeSingle();
    clearTimeout(timeout);
    // PGRST116 = no rows, that's fine
    return !error || error.code === 'PGRST116';
  } catch {
    return false;
  }
}

// ── Session recovery event bus ──────────────────────────────────
// 简易事件总线，让各组件（如 SyncProvider）能监听 session 恢复事件。
type RecoveryListener = () => void;
const _recoveryListeners: Set<RecoveryListener> = new Set();

/** 注册 session 恢复成功回调 */
export function onSessionRecovered(listener: RecoveryListener): () => void {
  _recoveryListeners.add(listener);
  return () => { _recoveryListeners.delete(listener); };
}

/** 通知所有监听者 session 已恢复（由 ConnectionGuard 调用） */
export function emitSessionRecovered() {
  _recoveryListeners.forEach((fn) => {
    try { fn(); } catch (e) { console.error('[supabase] recovery listener error:', e); }
  });
}
