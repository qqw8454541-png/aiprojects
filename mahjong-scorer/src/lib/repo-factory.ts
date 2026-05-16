/**
 * repo-factory.ts — 平台感知的仓储工厂
 *
 * 根据 Capacitor.isNativePlatform() 自动选择：
 *   - Web → SupabaseRepository（云端）
 *   - Android/iOS → LocalRepository（本地 SQLite）
 *
 * 使用动态 import() 确保 Web 端不会打包 SQLite 代码，
 * Android 端不会打包 Supabase 代码（tree-shaking）。
 */

import type { IRepository } from './repository';

let _repo: IRepository | null = null;
let _initPromise: Promise<IRepository> | null = null;

/**
 * 判断当前是否运行在原生平台（Android/iOS）。
 * 使用轻量检测方式，避免在 SSR 环境下导入 Capacitor。
 *
 * 多重验证以防止浏览器扩展注入 window.Capacitor 导致 Web 端误判：
 *  1. window.Capacitor 存在
 *  2. isNativePlatform 是一个返回 true 的函数（Capacitor 真实 API）
 *  3. getPlatform() 返回 'android' 或 'ios'（而非 'web'）
 */
function isNativePlatform(): boolean {
  if (typeof window === 'undefined') return false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cap = (window as any).Capacitor;
  if (!cap) return false;

  // Capacitor's real API exposes isNativePlatform as a *function*
  const isNative =
    typeof cap.isNativePlatform === 'function'
      ? cap.isNativePlatform()
      : cap.isNativePlatform === true;
  if (!isNative) return false;

  // Double-check: platform must be a known native target
  const platform: string | undefined =
    typeof cap.getPlatform === 'function' ? cap.getPlatform() : undefined;
  return platform === 'android' || platform === 'ios';
}

/**
 * 获取当前平台对应的仓储实例（单例，懒初始化）。
 *
 * 首次调用时会根据平台动态加载对应的实现模块，
 * 后续调用直接返回缓存实例。
 */
export function getRepository(): Promise<IRepository> {
  if (_repo) return Promise.resolve(_repo);

  // 避免并发初始化
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    if (isNativePlatform()) {
      const { LocalRepository } = await import('./local-repo');
      const repo = new LocalRepository();
      await repo.initialize();
      _repo = repo;
    } else {
      const { SupabaseRepository } = await import('./supabase-repo');
      _repo = new SupabaseRepository();
    }
    return _repo;
  })();

  return _initPromise;
}

/**
 * 返回平台类型标识（供 UI 层判断是否显示云端相关功能）
 */
export function getPlatformType(): 'native' | 'web' {
  return isNativePlatform() ? 'native' : 'web';
}
