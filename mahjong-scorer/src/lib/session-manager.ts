/**
 * session-manager.ts — Session 生命周期管理器
 *
 * 管理 idle timeout / absolute timeout / 唤醒恢复。
 * 单例模式，由 auth-store 的 initialize() 启动。
 *
 * 职责：
 *  1. 追踪用户活动，idle 超时后触发登出
 *  2. 无论活跃与否，absolute timeout 后强制登出
 *  3. 页面唤醒（visibilitychange）/ 网络恢复（online）时
 *     主动刷新 Supabase session
 *  4. 提供恢复状态回调供 UI 组件消费
 */

import { supabase } from './supabase';
import { getSessionPolicy, TIMING, type SessionPolicy } from './session-policy';

// ────────────────────────── Types ──────────────────────────────

export type SessionState =
  | 'active'      // 正常工作中
  | 'recovering'  // 唤醒恢复中
  | 'warning'     // 即将超时
  | 'expired';    // 已超时

export type ExpiredReason = 'idle' | 'absolute';

export interface SessionManagerCallbacks {
  onStateChange?: (state: SessionState) => void;
  onSessionExpired?: (reason: ExpiredReason) => void;
  onSessionWarning?: (remainingMs: number) => void;
  onRecoverySuccess?: () => void;
  onRecoveryFailed?: (error: Error) => void;
}

// ────────────────────────── Manager ───────────────────────────

class SessionManager {
  private policy: SessionPolicy;
  private callbacks: SessionManagerCallbacks = {};
  private state: SessionState = 'active';

  // Timers
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private absoluteTimer: ReturnType<typeof setTimeout> | null = null;
  private warningTimer: ReturnType<typeof setTimeout> | null = null;

  // Timestamps
  private lastActivity: number = Date.now();
  private sessionStart: number = Date.now();

  // Guards
  private isRecovering = false;
  private started = false;

  // Activity throttle
  private lastActivityReset = 0;
  private activityHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;

  constructor() {
    this.policy = getSessionPolicy();
  }

  /**
   * 启动 session 管理。仅对已登录用户调用。
   * 匿名用户只需要连接恢复，不需要 idle/absolute timeout。
   */
  start(callbacks: SessionManagerCallbacks, isLoggedIn: boolean) {
    if (this.started) return;
    this.started = true;
    this.callbacks = callbacks;
    this.policy = getSessionPolicy(); // 重新检测（可能在 hydration 后变化）
    this.sessionStart = Date.now();
    this.lastActivity = Date.now();

    if (isLoggedIn) {
      this.resetIdleTimer();
      this.startAbsoluteTimer();
    }

    this.bindListeners();
  }

  /** 停止管理，清理所有 timer 和 listener */
  stop() {
    this.started = false;
    this.clearAllTimers();
    this.unbindListeners();
  }

  /** 获取当前状态 */
  getState(): SessionState {
    return this.state;
  }

  /** 外部手动触发恢复（如用户点击 "重新连接" 按钮）*/
  async manualRecover(): Promise<boolean> {
    return this.handleWakeUp();
  }

  // ────────────────── Idle Timer ──────────────────────────────

  private resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.warningTimer) clearTimeout(this.warningTimer);
    this.lastActivity = Date.now();

    // 如果当前处于 warning 状态，恢复为 active
    if (this.state === 'warning') {
      this.setState('active');
    }

    // 超时警告定时器
    if (this.policy.showWarningBeforeLogout && this.policy.warningLeadMs > 0) {
      const warningAt = this.policy.idleTimeoutMs - this.policy.warningLeadMs;
      if (warningAt > 0) {
        this.warningTimer = setTimeout(() => {
          this.setState('warning');
          this.callbacks.onSessionWarning?.(this.policy.warningLeadMs);
        }, warningAt);
      }
    }

    // Idle 超时定时器
    this.idleTimer = setTimeout(() => {
      this.setState('expired');
      this.callbacks.onSessionExpired?.('idle');
    }, this.policy.idleTimeoutMs);
  }

  // ────────────────── Absolute Timer ─────────────────────────

  private startAbsoluteTimer() {
    if (this.absoluteTimer) clearTimeout(this.absoluteTimer);
    this.absoluteTimer = setTimeout(() => {
      this.setState('expired');
      this.callbacks.onSessionExpired?.('absolute');
    }, this.policy.absoluteTimeoutMs);
  }

  // ────────────────── Activity Tracking ──────────────────────

  private bindListeners() {
    // 用户活动事件（节流：30秒内最多处理一次）
    this.activityHandler = () => {
      const now = Date.now();
      if (now - this.lastActivityReset > TIMING.ACTIVITY_THROTTLE_MS) {
        this.lastActivityReset = now;
        if (this.started && this.state !== 'expired') {
          this.resetIdleTimer();
        }
      }
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) =>
      document.addEventListener(e, this.activityHandler!, { passive: true })
    );

    // 页面可见性变化
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        this.handleWakeUp();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // 网络恢复
    this.onlineHandler = () => {
      this.handleWakeUp();
    };
    window.addEventListener('online', this.onlineHandler);
  }

  private unbindListeners() {
    if (this.activityHandler) {
      const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
      events.forEach((e) =>
        document.removeEventListener(e, this.activityHandler!)
      );
      this.activityHandler = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
  }

  // ────────────────── Wake-up Recovery ───────────────────────

  /**
   * 唤醒恢复核心逻辑。
   * @returns true if recovery succeeded or was unnecessary
   */
  private async handleWakeUp(): Promise<boolean> {
    if (this.isRecovering || this.state === 'expired') return false;

    const now = Date.now();
    const idleElapsed = now - this.lastActivity;
    const absoluteElapsed = now - this.sessionStart;

    // 检查 absolute timeout（仅登录用户，有 absoluteTimer 时）
    if (this.absoluteTimer && absoluteElapsed >= this.policy.absoluteTimeoutMs) {
      this.setState('expired');
      this.callbacks.onSessionExpired?.('absolute');
      return false;
    }

    // 检查 idle timeout（仅登录用户，有 idleTimer 时）
    if (this.idleTimer && idleElapsed >= this.policy.idleTimeoutMs) {
      this.setState('expired');
      this.callbacks.onSessionExpired?.('idle');
      return false;
    }

    // 未超时 → 尝试恢复连接
    this.isRecovering = true;
    this.setState('recovering');

    try {
      await this.recoverSession();
      this.setState('active');
      if (this.idleTimer) this.resetIdleTimer();
      this.callbacks.onRecoverySuccess?.();
      return true;
    } catch (err) {
      // 恢复失败但未超时 → 保持 active 状态，让 withRetry 处理后续请求
      this.setState('active');
      this.callbacks.onRecoveryFailed?.(err as Error);
      return false;
    } finally {
      this.isRecovering = false;
    }
  }

  /**
   * 恢复 Supabase session — 带指数退避重试
   */
  private async recoverSession(): Promise<void> {
    const maxRetries = TIMING.RECOVERY_MAX_RETRIES;
    const baseDelay = TIMING.RECOVERY_BASE_DELAY_MS;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 1. 获取当前 session（触发 autoRefresh 如果过期）
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        // 2. 如果有 session，主动刷新 token
        if (data.session) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.warn('[SessionManager] Token refresh failed:', refreshError.message);
            // 不抛出 — getSession 可能已经恢复了 token
          }
        }

        // 3. 轻量级连接验证
        await this.pingDatabase();

        return; // 成功
      } catch (err) {
        console.warn(`[SessionManager] Recovery attempt ${attempt + 1}/${maxRetries} failed:`, err);
        if (attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, attempt)));
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * 轻量级数据库连通性检查
   */
  private async pingDatabase(): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMING.PING_TIMEOUT_MS);

    try {
      const { error } = await supabase
        .from('user_devices')
        .select('id')
        .limit(1)
        .abortSignal(controller.signal)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows found, OK
    } finally {
      clearTimeout(timeout);
    }
  }

  // ────────────────── Helpers ────────────────────────────────

  private setState(state: SessionState) {
    if (this.state === state) return;
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  private clearAllTimers() {
    if (this.idleTimer) { clearTimeout(this.idleTimer); this.idleTimer = null; }
    if (this.absoluteTimer) { clearTimeout(this.absoluteTimer); this.absoluteTimer = null; }
    if (this.warningTimer) { clearTimeout(this.warningTimer); this.warningTimer = null; }
  }
}

// ────────────────────────── Singleton ─────────────────────────

export const sessionManager = new SessionManager();
