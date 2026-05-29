'use client';

/**
 * VipGate — 付费功能拦截包装组件
 *
 * 用法：
 *   <VipGate feature="ai" onBlocked={optional}>
 *     <button onClick={doAI}>Generate AI Report</button>
 *   </VipGate>
 *
 * 当用户不满足条件时：
 * - 未登录 → 弹出 AuthModal
 * - 已登录但权限不足 → 弹出 UpgradePrompt
 * - 满足条件 → 正常渲染 children
 */

import { useAuthStore } from '@/lib/auth-store';

export type GateFeature = 'ai' | 'cloud_sync';

interface VipGateProps {
  feature: GateFeature;
  /** 可选：自定义阻断回调。如果提供，将代替默认的弹窗行为 */
  onBlocked?: () => void;
  children: React.ReactNode;
}

/**
 * 检查指定功能是否可用。返回 true 表示放行。
 */
export function checkFeatureAccess(
  feature: GateFeature
): { allowed: boolean; reason: 'not_logged_in' | 'need_pro' | 'ok' } {
  const state = useAuthStore.getState();

  switch (feature) {
    case 'ai':
      if (!state.isLoggedIn) return { allowed: false, reason: 'not_logged_in' };
      if (!state.isPro) return { allowed: false, reason: 'need_pro' };
      return { allowed: true, reason: 'ok' };

    case 'cloud_sync':
      if (!state.isLoggedIn) return { allowed: false, reason: 'not_logged_in' };
      if (!state.isPro) return { allowed: false, reason: 'need_pro' };
      return { allowed: true, reason: 'ok' };

    default:
      return { allowed: true, reason: 'ok' };
  }
}

/**
 * 触发对应的阻断行为（弹窗）。
 */
export function triggerGateAction(feature: GateFeature) {
  const state = useAuthStore.getState();
  const access = checkFeatureAccess(feature);

  if (access.allowed) return true;

  switch (access.reason) {
    case 'not_logged_in':
      state.openAuthModal(
        feature === 'ai' ? 'ai' : feature === 'cloud_sync' ? 'cloud_sync' : 'limit_reached'
      );
      return false;

    case 'need_pro':
      state.openUpgradePrompt('pro');
      return false;

    default:
      return true;
  }
}

export default function VipGate({ feature, onBlocked, children }: VipGateProps) {
  const handleClick = (e: React.MouseEvent) => {
    const access = checkFeatureAccess(feature);
    if (!access.allowed) {
      e.preventDefault();
      e.stopPropagation();
      if (onBlocked) {
        onBlocked();
      } else {
        triggerGateAction(feature);
      }
    }
    // If allowed, let the click pass through to children
  };

  return (
    <div onClick={handleClick}>
      {children}
    </div>
  );
}
