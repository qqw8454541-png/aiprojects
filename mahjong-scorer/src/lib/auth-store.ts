'use client';

/**
 * auth-store.ts — 认证与权限 Zustand Store
 *
 * 独立于 store.ts（游戏状态），专门管理用户身份、VIP 层级、AI 额度。
 * 使用 persist 中间件持久化到 localStorage。
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@supabase/supabase-js';
import { supabase, markAuthReady } from './supabase';
import type { UserTier } from './billing.constants';
import { useGameStore } from './store';
import { claimDevice, registerDevice, collectDeviceInfo } from './device-info';
import { Capacitor } from '@capacitor/core';
import { syncEngine } from './sync-engine';
import { billingService } from './billing-service';
import { getSavedLocale, translate } from './i18n';

export type AuthProvider = 'google' | 'apple' | 'email' | 'phone';

// ────────────────────────── Types ──────────────────────────────

export type AuthModalContext = 'ai' | 'cloud_sync' | 'limit_reached' | 'general';

interface AuthState {
  // 用户身份
  user: User | null;
  isLoggedIn: boolean;

  // 权限层级
  tier: UserTier;

  // UI 控制
  showAuthModal: boolean;
  authModalContext: AuthModalContext;
  showUpgradePrompt: boolean;
  upgradePromptTab: 'pro' | 'ai';

  // Sync State
  syncState: { isSyncing: boolean; progress: any | null };
  setSyncState: (state: Partial<{ isSyncing: boolean; progress: any | null }>) => void;

  // ── Computed ──────────────────────────────────────────────
  isPro: boolean;

  // ── Auth Modal ────────────────────────────────────────────
  openAuthModal: (context: AuthModalContext) => void;
  closeAuthModal: () => void;

  // ── Upgrade Prompt ────────────────────────────────────────
  openUpgradePrompt: (tab?: 'pro' | 'ai') => void;
  closeUpgradePrompt: () => void;

  // ── Auth Actions ──────────────────────────────────────────
  login: (provider: AuthProvider, credential?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;

  // ── Credit & Tier Actions ─────────────────────────────────
  upgradeToPro: () => void;
  downgradeToFree: () => void;

  // ── Init ──────────────────────────────────────────────────
  initialize: () => void;
}

// ────────────────────────── Store ──────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoggedIn: false,
      tier: 'free',

      showAuthModal: false,
      authModalContext: 'general',
      showUpgradePrompt: false,
      upgradePromptTab: 'pro',

      syncState: { isSyncing: false, progress: null },
      setSyncState: (state) => set((prev) => ({ syncState: { ...prev.syncState, ...state } })),

      // ── Computed ────────────────────────────────────────────

      isPro: false,

      // ── Auth Modal ──────────────────────────────────────────

      openAuthModal: (context) =>
        set({ showAuthModal: true, authModalContext: context }),

      closeAuthModal: () =>
        set({ showAuthModal: false }),

      // ── Upgrade Prompt ──────────────────────────────────────

      openUpgradePrompt: (tab = 'pro') =>
        set({ showUpgradePrompt: true, upgradePromptTab: tab }),

      closeUpgradePrompt: () =>
        set({ showUpgradePrompt: false }),

      // ── Auth Actions ────────────────────────────────────────

      login: async (provider, credential?) => {
        try {
          if (provider === 'google' || provider === 'apple') {
            const { error } = await supabase.auth.signInWithOAuth({
              provider,
              options: {
                redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
              }
            });
            if (error) throw error;
            // For OAuth, the redirect handles the session, so we don't set user immediately here.
            return { success: true };
          }
          
          return { success: false, error: 'unsupported_provider' };
        } catch (e: any) {
          return { success: false, error: e.message || 'unknown_error' };
        }
      },

      logout: async () => {
        await supabase.auth.signOut();
        set({
          user: null,
          isLoggedIn: false,
          // 保留 tier（与设备绑定，不随登出清除）
        });
      },

      // ── Credit & Tier Actions ───────────────────────────────

      upgradeToPro: () =>
        set({
          tier: 'pro',
          isPro: true,
        }),

      downgradeToFree: () =>
        set({
          tier: 'free',
          isPro: false,
        }),

      // ── Init ────────────────────────────────────────────────

      initialize: () => {
        const fetchTier = async (userId: string) => {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('tier')
              .eq('user_id', userId)
              .single();
            if (error) {
              if (error.code === 'PGRST116') {
                // If no profile exists for this user, insert a default free profile
                await supabase.from('profiles').insert({ user_id: userId, tier: 'free' });
                set({ tier: 'free', isPro: false });
              } else {
                console.error('Failed to fetch tier:', error);
              }
            } else if (data?.tier) {
              set({ tier: data.tier as any, isPro: data.tier === 'pro' });
            }
          } catch (e) {
            console.error('Failed to fetch tier:', e);
          }
        };

        // Initial session check
        supabase.auth.getSession().then(async ({ data: { session }, error }) => {
          if (error) {
            console.error('Supabase auth session error:', error);
            // If the refresh token is invalid (e.g. wiped local DB), sign out to clear it
            if (error.name === 'AuthApiError') {
              supabase.auth.signOut().catch(() => {});
              if (typeof window !== 'undefined') {
                alert(translate(getSavedLocale(), 'auth.sessionExpired' as any));
              }
            }
            markAuthReady(); // 即使出错也要放行，否则查询永远挂起
            return;
          }
          
          if (session?.user) {
            set({ user: session.user, isLoggedIn: true, showAuthModal: false });
            await fetchTier(session.user.id);
            // Try claim device and start sync if pro
            try {
              const deviceId = useGameStore.getState().deviceId;
              if (deviceId) {
                await claimDevice(deviceId, session.user.id);
                const info = await collectDeviceInfo(deviceId);
                await registerDevice(info, session.user.id);
                
                // If native platform and pro, start incremental sync
                if (Capacitor.getPlatform() !== 'web' && get().isPro) {
                  syncEngine.incrementalSync();
                }
              }
            } catch (e) {
              console.error('Device claim/sync failed on load:', e);
            }

            // 初始化付费 SDK 并监听权限变化
            try {
              await billingService.init();
              // 从商店同步权限状态（用户可能在其他设备购买/取消了订阅）
              const storeOwned = billingService.checkEntitlement();
              if (storeOwned && !get().isPro) {
                get().upgradeToPro();
              }
              // 监听后续权限变化
              billingService.onEntitlementChanged((isEntitled) => {
                if (isEntitled) {
                  get().upgradeToPro();
                } else {
                  get().downgradeToFree();
                }
              });
            } catch (e) {
              console.error('Billing init failed on load:', e);
            }
          }
          markAuthReady(); // Session 恢复完毕，放行所有等待中的数据查询
        }).catch(err => {
          console.error('Unexpected error during auth initialization:', err);
          markAuthReady(); // 异常情况也要放行
        });

        // Listen for auth changes
        supabase.auth.onAuthStateChange((_event, session) => {
          if (session?.user) {
            set({ user: session.user, isLoggedIn: true, showAuthModal: false });
            
            // Run async DB queries outside the callback to prevent Supabase auth lock deadlocks
            setTimeout(async () => {
              await fetchTier(session.user.id);
              // Claim device and register on login
              try {
                const deviceId = useGameStore.getState().deviceId;
                if (deviceId) {
                  await claimDevice(deviceId, session.user.id);
                  const info = await collectDeviceInfo(deviceId);
                  await registerDevice(info, session.user.id);
                  
                  // If native platform and pro, start incremental sync
                  if (Capacitor.getPlatform() !== 'web' && get().isPro) {
                    syncEngine.incrementalSync();
                  }
                }
              } catch (e) {
                console.error('Device claim/sync failed on auth change:', e);
              }
            }, 0);
          } else {
            set({ user: null, isLoggedIn: false });
          }
        });
      },
    }),
    {
      name: 'mahjong-auth-storage',
      // Only persist serializable state, skip functions and transient UI
      partialize: (state) => ({
        user: state.user,
        isLoggedIn: state.isLoggedIn,
        tier: state.tier,
        isPro: state.isPro,
      }),
    }
  )
);
