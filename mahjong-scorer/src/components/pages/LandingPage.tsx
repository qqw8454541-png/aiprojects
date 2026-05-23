'use client';
import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import type { Wind, PlayerScore, PlayerResult } from '@/lib/scoring';
import { safeRandomUUID } from '@/lib/utils';

export default function LandingPage() {
  const { t } = useI18n();
  const setPage = useGameStore((s) => s.setPage);
  const { deviceId } = useGameStore();
  useEffect(() => {
    if (!deviceId) {
      const key = 'mahjong-device-id';
      let id = localStorage.getItem(key);
      if (!id) {
        id = safeRandomUUID();
        localStorage.setItem(key, id);
      }
      useGameStore.setState({ deviceId: id });
    }
  }, [deviceId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 page-enter relative overflow-hidden">
      {/* Subtle green tint matching the new icon */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/10 via-transparent to-zinc-950/20 pointer-events-none z-0 dark:from-emerald-950/30" />

      <div className="text-center mb-12 relative z-10 w-full">
        <div className="relative w-32 h-32 mx-auto mb-6 animate-[float_4s_ease-in-out_infinite]">
          <img 
            src="/icon.png" 
            alt="App Icon" 
            className="w-full h-full object-contain drop-shadow-2xl relative z-10"
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 bg-emerald-600/30 rounded-full blur-2xl z-0"/>
        </div>
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
          {t('app.title')}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">{t('app.subtitle')}</p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <button
          onClick={() => setPage('personal-menu')}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold
                     hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] transition-all
                     shadow-lg shadow-emerald-900/30 flex flex-col items-center gap-1"
        >
          <span className="text-lg">🀄 {t('landing.personalMode')}</span>
          <span className="text-xs font-normal opacity-75">{t('landing.personalModeDesc')}</span>
        </button>

        <button
          onClick={() => setPage('venue-coming-soon')}
          className="w-full py-5 rounded-2xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700
                     text-zinc-600 dark:text-zinc-300 font-bold
                     hover:bg-zinc-200 dark:hover:bg-zinc-700 active:scale-[0.98] transition-all
                     flex flex-col items-center gap-1"
        >
          <span className="text-lg">🏮 {t('landing.venueMode')}</span>
          <span className="text-xs font-normal opacity-60">{t('landing.venueModeDesc')}</span>
        </button>



      </div>
    </div>
  );
}
