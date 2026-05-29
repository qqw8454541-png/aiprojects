'use client';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';

export default function PersonalMenuPage() {
  const { t } = useI18n();
  const { setPage, roomCode } = useGameStore();
  const { isLoggedIn, user, isPro, openAuthModal, openUpgradePrompt, logout } = useAuthStore();

  const isResuming = !!roomCode;

  const items = [
    ...(isResuming
      ? [
        {
          page: 'room' as const,
          icon: '🎮',
          label: 'room.continueMatch' as any,
          desc: 'personal.newGameDesc' as any,
          color: 'from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600',
          shadow: 'shadow-emerald-900/20',
          textColor: 'text-white',
        },
      ]
      : []),
    {
      page: 'create' as const,
      icon: '🎴',
      label: 'personal.newGame' as any,
      desc: 'personal.newGameDesc' as any,
      color: 'from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600',
      shadow: 'shadow-emerald-900/20',
      textColor: 'text-white',
    },
    {
      page: 'manage-rooms' as const,
      icon: '⚙️',
      label: 'personal.manageRooms' as any,
      desc: 'personal.manageRoomsDesc' as any,
      color: 'from-zinc-200 to-zinc-300 dark:from-zinc-600 dark:to-zinc-700',
      shadow: 'shadow-zinc-300/50 dark:shadow-zinc-900/20',
      textColor: 'text-zinc-800 dark:text-zinc-100',
    },
  ];

  return (
    <div className="flex flex-col min-h-dvh pt-24 px-5 page-enter">
      <div className="space-y-4">
        {items.map((item) => (
          <button
            key={item.page}
            onClick={() => setPage(item.page)}
            className={`w-full py-5 px-6 rounded-2xl bg-gradient-to-r ${item.color} ${item.textColor}
                       hover:brightness-110 active:scale-[0.98] transition-all shadow-lg ${item.shadow}
                       flex items-center gap-4 text-left`}
          >
            <span className="text-3xl">{item.icon}</span>
            <div>
              <div className="font-bold text-lg leading-tight">{t(item.label)}</div>
              <div className="text-sm opacity-75 mt-0.5">{t(item.desc)}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Auth & Billing Section ────────────────────────────── */}
      <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
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
                {t('auth.loginSignup' as Parameters<typeof t>[0]) || 'Login / Sign Up'}
              </div>
              <div className="text-xs opacity-75 mt-0.5">
                {t('auth.loginBenefit' as Parameters<typeof t>[0]) || 'Unlock cloud sync & AI features'}
              </div>
            </div>
          </button>
        ) : (
          <>
            {/* 已登录：显示用户信息 */}
            <div className="flex items-center gap-3 px-2 py-1">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow">
                {(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || user?.phone?.slice(-4) || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || (user?.phone ? `Phone User` : 'User')}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {user?.email || user?.phone || user?.id?.slice(0, 8)}
                </div>
              </div>
              {isPro && (
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                  ⭐ Pro
                </span>
              )}
            </div>


            {/* Pro 升级 (仅在非 Pro 时显示) */}
            {!isPro && (
              <button
                onClick={() => openUpgradePrompt('pro')}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold
                           hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-amber-900/20
                           flex items-center gap-3"
              >
                <span className="text-xl">⭐</span>
                <span>{t('upgrade.upgradeToProBtn' as Parameters<typeof t>[0]) || 'Upgrade to Pro'}</span>
              </button>
            )}

            {/* 登出 */}
            <button
              onClick={logout}
              className="w-full py-2.5 text-sm text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              {t('auth.logout' as Parameters<typeof t>[0]) || 'Sign Out'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

