/**
 * session-policy.ts — 设备感知的 Session 策略配置
 *
 * 根据设备类型（手机Web、桌面Web、原生App、麻将馆Kiosk）
 * 提供不同的 idle timeout / absolute timeout / 恢复策略。
 */

// ────────────────────────── Types ──────────────────────────────

export interface SessionPolicy {
  /** 无操作后多久视为超时 (ms) */
  idleTimeoutMs: number;
  /** 无论是否活跃，最长 session 时间 (ms) */
  absoluteTimeoutMs: number;
  /** 唤醒后恢复连接最大等待时间 (ms) */
  wakeRecoveryMs: number;
  /** 是否在即将超时时弹出警告 */
  showWarningBeforeLogout: boolean;
  /** 超时警告提前多少 ms 显示 */
  warningLeadMs: number;
}

export type DeviceType = 'mobile-web' | 'desktop-web' | 'native' | 'venue-kiosk';

// ────────────────────────── Policies ───────────────────────────

const POLICIES: Record<DeviceType, SessionPolicy> = {
  /** 手机端 Web — 长 idle，打麻将时手机会反复熄屏 */
  'mobile-web': {
    idleTimeoutMs:       4 * 60 * 60 * 1000,   // 4 小时
    absoluteTimeoutMs:  24 * 60 * 60 * 1000,   // 24 小时
    wakeRecoveryMs:      10_000,                // 10 秒
    showWarningBeforeLogout: true,
    warningLeadMs:       5 * 60 * 1000,         // 5 分钟前
  },
  /** 桌面端 Web — 可能是公共电脑，稍短 */
  'desktop-web': {
    idleTimeoutMs:       2 * 60 * 60 * 1000,   // 2 小时
    absoluteTimeoutMs:  12 * 60 * 60 * 1000,   // 12 小时
    wakeRecoveryMs:      10_000,
    showWarningBeforeLogout: true,
    warningLeadMs:       5 * 60 * 1000,
  },
  /** 原生移动 App — 最长，App 自己管理生命周期 */
  'native': {
    idleTimeoutMs:       7 * 24 * 60 * 60 * 1000,  // 7 天
    absoluteTimeoutMs:  30 * 24 * 60 * 60 * 1000,  // 30 天
    wakeRecoveryMs:      5_000,
    showWarningBeforeLogout: false,
    warningLeadMs:       0,
  },
  /** 麻将馆模式（未来）— 公共设备，严格超时 */
  'venue-kiosk': {
    idleTimeoutMs:      30 * 60 * 1000,         // 30 分钟
    absoluteTimeoutMs:   8 * 60 * 60 * 1000,    // 8 小时
    wakeRecoveryMs:      5_000,
    showWarningBeforeLogout: true,
    warningLeadMs:       2 * 60 * 1000,
  },
};

// ────────────────────────── Detection ─────────────────────────

/**
 * 根据运行环境检测设备类型。
 *
 * 优先级：Capacitor 原生 > venue-mode flag > UA 检测
 */
export function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop-web';

  // 原生 App (Capacitor)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cap = (window as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    return 'native';
  }

  // 麻将馆模式（未来：通过 URL param 或 localStorage flag 激活）
  try {
    if (localStorage.getItem('venue-mode') === 'true') return 'venue-kiosk';
  } catch {
    // localStorage 不可用时忽略
  }

  // 移动 Web vs 桌面 Web
  const isMobile =
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    ('ontouchstart' in window && window.innerWidth < 1024);
  return isMobile ? 'mobile-web' : 'desktop-web';
}

/**
 * 获取当前设备对应的 Session 策略
 */
export function getSessionPolicy(): SessionPolicy {
  return POLICIES[detectDeviceType()];
}

/**
 * 获取指定设备类型的 Session 策略（用于测试/覆写）
 */
export function getSessionPolicyFor(device: DeviceType): SessionPolicy {
  return POLICIES[device];
}

// ────────────────────────── Timing Constants ──────────────────
// 所有与时间/重试相关的常量统一管理于此。
// 修改超时策略只需编辑这一个文件。

export const TIMING = {
  /** 用户活动检测的节流间隔 (ms) — 30 秒内最多触发一次 idle 重置 */
  ACTIVITY_THROTTLE_MS: 30_000,

  /** SessionManager 唤醒恢复的最大重试次数 */
  RECOVERY_MAX_RETRIES: 3,

  /** SessionManager 唤醒恢复重试的基础延迟 (ms)，指数退避：baseDelay * 2^attempt */
  RECOVERY_BASE_DELAY_MS: 1_000,

  /** 数据库 ping 检查的超时时间 (ms) */
  PING_TIMEOUT_MS: 5_000,

  /** supabase-repo withRetry 的最大重试次数 */
  REPO_RETRY_MAX: 2,

  /** supabase-repo withRetry 重试间的基础延迟 (ms)，线性递增：baseDelay * (attempt + 1) */
  REPO_RETRY_BASE_DELAY_MS: 500,
} as const;
