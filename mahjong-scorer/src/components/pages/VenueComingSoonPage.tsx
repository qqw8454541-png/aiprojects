'use client';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';

export default function VenueComingSoonPage() {
  const { t } = useI18n();
  const setPage = useGameStore((s) => s.setPage);
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 page-enter text-center">
      <div className="text-6xl mb-6">🏮</div>
      <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 mb-3">{t('landing.venueMode')}</h1>
      <p className="text-zinc-500 dark:text-zinc-400 mb-10 max-w-xs">{t('landing.comingSoonDesc')}</p>
      <div className="px-6 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-sm font-bold mb-10">
        🚧 {t('landing.comingSoon')}
      </div>
      <button
        onClick={() => setPage('landing')}
        className="py-3 px-8 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all"
      >
        ← {t('landing.backToTop')}
      </button>
    </div>
  );
}
