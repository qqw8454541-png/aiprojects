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
import { supabase } from './supabase';
import type { UserTier } from './billing.constants';
import { getRepository } from './repo-factory';
import { useGameStore } from './store';

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

  // ── Computed ──────────────────────────────────────────────
  isPro: () => boolean;

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

      // ── Computed ────────────────────────────────────────────

      isPro: () => get().tier === 'pro',

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
            if (!error && data?.tier) {
              set({ tier: data.tier as any });
            }
          } catch (e) {
            console.error('Failed to fetch tier:', e);
          }
        };

        // Initial session check
        supabase.auth.getSession().then(async ({ data: { session } }) => {
          if (session?.user) {
            set({ user: session.user, isLoggedIn: true, showAuthModal: false });
            await fetchTier(session.user.id);
            // Try migrate on initial load just in case it was missed
            try {
              const repo = await getRepository();
              if (repo.migrateGuestData) {
                const deviceId = useGameStore.getState().deviceId;
                if (deviceId) {
                  await repo.migrateGuestData(deviceId, session.user.id);
                }
              }
            } catch (e) {
              console.error('Data migration failed on auth change:', e);
            }
          }
        });

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user) {
            set({ user: session.user, isLoggedIn: true, showAuthModal: false });
            await fetchTier(session.user.id);
            // Migrate local data to the newly logged-in user
            try {
              const repo = await getRepository();
              if (repo.migrateGuestData) {
                const deviceId = useGameStore.getState().deviceId;
                if (deviceId) {
                  await repo.migrateGuestData(deviceId, session.user.id);
                }
              }
            } catch (e) {
              console.error('Data migration failed on auth change:', e);
            }
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
      }),
    }
  )
);
