'use client';

/**
 * ConnectionGuard — 全局连接恢复 UI 组件
 *
 * 职责：
 *  1. 将 SessionManager 与 React 生命周期和 UI 集成
 *  2. 在唤醒恢复时显示 banner
 *  3. 在 session 即将超时时显示警告
 *  4. session 过期后执行登出
 *  5. 恢复成功后通知 SyncProvider 重连 Realtime Channel
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sessionManager, type SessionState } from '@/lib/session-manager';
import { useAuthStore } from '@/lib/auth-store';
import { emitSessionRecovered } from '@/lib/supabase';
import { useI18n } from '@/lib/i18n';

export default function ConnectionGuard() {
  const { t } = useI18n();
  const { isLoggedIn, logout } = useAuthStore();
  const [sessionState, setSessionState] = useState<SessionState>('active');
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const startedRef = useRef(false);

  const handleSessionExpired = useCallback(
    (reason: 'idle' | 'absolute') => {
      console.info(`[ConnectionGuard] Session expired: ${reason}`);
      if (isLoggedIn) {
        logout();
      }
    },
    [isLoggedIn, logout]
  );

  useEffect(() => {
    // 只在浏览器端启动，跳过 SSR
    if (typeof window === 'undefined') return;
    if (startedRef.current) return;
    startedRef.current = true;

    sessionManager.start(
      {
        onStateChange: (state) => {
          setSessionState(state);
          if (state === 'active') {
            setRecoveryFailed(false);
          }
        },
        onSessionExpired: handleSessionExpired,
        onSessionWarning: (_remainingMs) => {
          // warning state already set via onStateChange
        },
        onRecoverySuccess: () => {
          console.info('[ConnectionGuard] Session recovered successfully');
          emitSessionRecovered();
        },
        onRecoveryFailed: (err) => {
          console.warn('[ConnectionGuard] Session recovery failed:', err.message);
          setRecoveryFailed(true);
        },
      },
      isLoggedIn
    );

    return () => {
      sessionManager.stop();
      startedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 手动重试按钮
  const handleManualRetry = async () => {
    setRecoveryFailed(false);
    const success = await sessionManager.manualRecover();
    if (success) {
      emitSessionRecovered();
    }
  };

  // 手动刷新页面
  const handleRefresh = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <AnimatePresence>
      {/* 恢复中 Banner */}
      {sessionState === 'recovering' && (
        <motion.div
          key="recovering"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500/95 text-white text-sm font-medium py-2 px-4 backdrop-blur-sm safe-area-pt"
        >
          <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          <span>{t('connection.recovering' as Parameters<typeof t>[0]) || '正在恢复连接...'}</span>
        </motion.div>
      )}

      {/* 恢复失败 Banner */}
      {recoveryFailed && sessionState === 'active' && (
        <motion.div
          key="failed"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 bg-red-500/95 text-white text-sm font-medium py-2.5 px-4 backdrop-blur-sm safe-area-pt"
        >
          <span>{t('connection.failed' as Parameters<typeof t>[0]) || '连接已断开'}</span>
          <button
            onClick={handleManualRetry}
            className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition"
          >
            {t('common.retry' as Parameters<typeof t>[0]) || '重试'}
          </button>
          <button
            onClick={handleRefresh}
            className="px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition"
          >
            {t('connection.refresh' as Parameters<typeof t>[0]) || '刷新'}
          </button>
        </motion.div>
      )}

      {/* Session 即将过期警告 */}
      {sessionState === 'warning' && isLoggedIn && (
        <motion.div
          key="warning"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ duration: 0.3 }}
          className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 bg-orange-500/95 text-white text-sm font-medium py-2.5 px-4 backdrop-blur-sm safe-area-pt"
        >
          <span>{t('connection.sessionExpiring' as Parameters<typeof t>[0]) || '会话即将过期，请操作以保持在线'}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
