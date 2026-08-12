'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { billingService } from '@/lib/billing-service';
import { Capacitor } from '@capacitor/core';

/* ── Premium Mahjong-themed SVG Icons ──────────────────────────── */
const MahjongContinueIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
    {/* Base Token - like a classic dealer button */}
    <circle cx="20" cy="20" r="17" fill="white" />
    {/* Inner decorative dashed ring */}
    <circle cx="20" cy="20" r="13" fill="none" stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="3 3" />
    {/* Play Icon */}
    <path d="M16 13 L27 20 L16 27 Z" fill="#F59E0B" stroke="#F59E0B" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

const MahjongNewIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-md">
    {/* Left Die (showing 4 - traditional red in mahjong) */}
    <g transform="translate(2, 6) rotate(-8)">
      <rect x="0" y="0" width="20" height="20" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="1" />
      <circle cx="6" cy="6" r="2.5" fill="#EF4444" />
      <circle cx="14" cy="6" r="2.5" fill="#EF4444" />
      <circle cx="6" cy="14" r="2.5" fill="#EF4444" />
      <circle cx="14" cy="14" r="2.5" fill="#EF4444" />
    </g>
    {/* Right Die (showing 1 - traditional large red dot) */}
    <g transform="translate(18, 12) rotate(12)">
      <rect x="0" y="0" width="20" height="20" rx="4" fill="white" stroke="#E2E8F0" strokeWidth="1" />
      <circle cx="10" cy="10" r="5" fill="#EF4444" />
    </g>
    {/* Sparkle */}
    <path d="M30 2 L31.5 6 L35.5 7.5 L31.5 9 L30 13 L28.5 9 L24.5 7.5 L28.5 6 Z" fill="#FCD34D" />
  </svg>
);

export default function PersonalMenuPage() {
  const { t } = useI18n();
  const { setPage, roomCode } = useGameStore();
  const { isLoggedIn, user, isPro, openAuthModal, openUpgradePrompt, logout } = useAuthStore();

  const isResuming = !!roomCode;
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false);

  const items = [
    ...(isResuming
      ? [
        {
          page: 'room' as const,
          icon: <MahjongContinueIcon />,
          label: 'room.continueMatch' as any,
          desc: 'personal.newGameDesc' as any,
          color: 'from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600',
          shadow: 'shadow-amber-900/20',
          textColor: 'text-white',
        },
      ]
      : []),
    {
      page: 'create' as const,
      icon: <MahjongNewIcon />,
      label: 'personal.newGame' as any,
      desc: 'personal.newGameDesc' as any,
      color: 'from-indigo-500 to-blue-500 dark:from-indigo-600 dark:to-blue-600',
      shadow: 'shadow-indigo-900/20',
      textColor: 'text-white',
    }
  ];

  return (
    <div className="flex flex-col min-h-dvh pt-safe-24 px-5 pb-8 page-enter">
      <div className="space-y-4">
        {items.map((item) => (
          <button
            key={item.page}
            onClick={() => {
              if (item.page === 'create' && isResuming) {
                setShowNewGameConfirm(true);
              } else {
                setPage(item.page);
              }
            }}
            className={`w-full py-5 px-6 rounded-2xl bg-gradient-to-r ${item.color} ${item.textColor}
                       hover:brightness-110 active:scale-[0.98] transition-all shadow-lg ${item.shadow}
                       flex items-center gap-4 text-left`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <div>
              <div className="font-bold text-lg leading-tight">{t(item.label)}</div>
              <div className="text-sm opacity-75 mt-0.5">{t(item.desc)}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-[32px]" />

      {/* ── Room & Member Management Split Cards ────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={() => {
            useGameStore.getState().setManageRoomsMode('rooms');
            setPage('manage-rooms');
          }}
          className="p-4 rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 
                   hover:bg-zinc-50 dark:hover:bg-zinc-700/80 active:scale-[0.98] transition-all shadow-sm
                   flex flex-col items-start gap-2 group text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl group-hover:scale-110 transition-transform">🏠</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{t('personal.roomManageLabel' as Parameters<typeof t>[0])}</span>
          </div>
          <div className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 font-medium">
            {t('personal.roomManageHint' as Parameters<typeof t>[0])}
          </div>
        </button>

        <button
          onClick={() => {
            useGameStore.getState().setManageRoomsMode('members');
            setPage('manage-rooms');
          }}
          className="p-4 rounded-2xl bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 
                   hover:bg-zinc-50 dark:hover:bg-zinc-700/80 active:scale-[0.98] transition-all shadow-sm
                   flex flex-col items-start gap-2 group text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl group-hover:scale-110 transition-transform">👥</span>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">{t('personal.memberManageLabel' as Parameters<typeof t>[0])}</span>
          </div>
          <div className="text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 font-medium">
            {t('personal.memberManageHint' as Parameters<typeof t>[0])}
          </div>
        </button>
      </div>

      {/* ── Auth & Billing Section ────────────────────────────── */}
      <div className="pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
        {!isLoggedIn ? (
          /* 未登录：显示登录入口 */
          <button
            onClick={() => openAuthModal('general')}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold
                       hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-indigo-900/20
                       flex items-center gap-4 text-left"
          >
            <span className="text-2xl">🔐</span>
            <div>
              <div className="font-bold text-base leading-tight">
                {t('auth.loginSignup' as Parameters<typeof t>[0])}
              </div>
              <div className="text-xs opacity-75 mt-0.5">
                {t('auth.loginBenefit' as Parameters<typeof t>[0])}
              </div>
            </div>
          </button>
        ) : (
          <>
            {/* 已登录：显示用户信息，设为可点击 */}
            <button
              onClick={() => setPage('profile')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:brightness-95 dark:hover:brightness-110 active:scale-[0.98] transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow">
                {(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || user?.phone?.slice(-4) || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-2">
                  {user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || (user?.phone ? `Phone User` : 'User')}
                  {isPro && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                      ⭐ PRO
                    </span>
                  )}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  {user?.email || user?.phone || user?.id?.slice(0, 8)}
                </div>
              </div>
              <div className="text-zinc-400 dark:text-zinc-500 flex-shrink-0 group-hover:translate-x-1 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </div>
            </button>


            {/* Pro 升级 (仅在非 Pro 时显示) */}
            {!isPro && (
              <button
                onClick={() => openUpgradePrompt('pro')}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold
                           hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-amber-900/20
                           flex items-center gap-3"
              >
                <span className="text-xl">⭐</span>
                <span>{t('upgrade.upgradeToProBtn' as Parameters<typeof t>[0])}</span>
              </button>
            )}

            {/* 购入を復元 (原生平台のみ、非 Pro ユーザー向け) */}
            {!isPro && Capacitor.getPlatform() !== 'web' && (
              <button
                onClick={async () => {
                  const restored = await billingService.restorePurchases();
                  if (restored) {
                    useAuthStore.getState().upgradeToPro();
                  }
                }}
                className="w-full py-2.5 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors font-medium"
              >
                {t('upgrade.restore' as Parameters<typeof t>[0])}
              </button>
            )}

            {/* 登出 */}
            <button
              onClick={logout}
              className="w-full py-2.5 text-sm text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              {t('auth.logout' as Parameters<typeof t>[0])}
            </button>
          </>
        )}
      </div>

      {/* New Game Confirmation Modal */}
      <AnimatePresence>
        {showNewGameConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 glass-overlay flex items-center justify-center p-4"
            onClick={() => setShowNewGameConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-xl"
            >
              <div className="p-6 text-center">
                <div className="text-4xl mb-3">⚠️</div>
                <div className="mb-6">
                  <p className="text-zinc-800 dark:text-zinc-200 font-bold text-lg mb-2">
                    {t('personal.confirmNewGame' as Parameters<typeof t>[0])}
                  </p>
                  <p className="text-zinc-500 dark:text-zinc-400 font-medium text-xs opacity-80 leading-relaxed">
                    {t('personal.confirmNewGameHint' as Parameters<typeof t>[0])}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowNewGameConfirm(false)}
                    className="flex-1 py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold transition hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  >
                    {t('room.cancel' as Parameters<typeof t>[0])}
                  </button>
                  <button
                    onClick={() => {
                      setShowNewGameConfirm(false);
                      setPage('create');
                    }}
                    className="flex-1 py-3 rounded-xl bg-rose-500 text-white font-bold transition hover:bg-rose-400 active:scale-[0.97]"
                  >
                    {t('room.confirm' as Parameters<typeof t>[0])}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

