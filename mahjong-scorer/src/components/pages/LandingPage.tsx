'use client';
import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import type { Wind, PlayerScore, PlayerResult } from '@/lib/scoring';
import { safeRandomUUID } from '@/lib/utils';

export default function LandingPage() {
  const { t } = useI18n();
  const setPage = useGameStore((s) => s.setPage);
  const { deviceId } = useGameStore();
  const [showAgeGate, setShowAgeGate] = useState(false);


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

    if (typeof window !== 'undefined') {
      const verified = localStorage.getItem('age_verified');
      if (!verified) {
        setShowAgeGate(true);
      }
    }
  }, [deviceId]);

  const handleAgeConfirm = () => {
    localStorage.setItem('age_verified', 'true');
    setShowAgeGate(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 page-enter">
      {showAgeGate && (
        <div className="fixed inset-0 z-[100] bg-zinc-950 flex items-center justify-center p-6 text-center">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-4">🔞 18+ Age Verification</h2>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              This application is a tool for recording scores and is strictly for entertainment and mathematical tracking. By continuing, you confirm that you are at least 18 years of age and will not use this application for any real-money gambling or illegal activities.
            </p>
            <div className="space-y-3">
              <button 
                onClick={handleAgeConfirm}
                className="w-full py-4 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-500 active:scale-95 transition-all"
              >
                I Confirm I am 18+
              </button>
              <button 
                onClick={() => alert("You must be 18+ to use this app.")}
                className="w-full py-4 rounded-xl bg-zinc-800 text-zinc-400 font-medium hover:bg-zinc-700 transition-all"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center mb-12">
        <div className="relative w-32 h-32 mx-auto mb-6">
          <svg viewBox="0 0 120 120" className="w-full h-full animate-[float_4s_ease-in-out_infinite] filter drop-shadow-xl relative z-10" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(10, 85) rotate(-15)">
              <rect x="0" y="0" width="100" height="12" rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5"/>
              <circle cx="50" cy="6" r="4" fill="#ef4444"/>
              <circle cx="20" cy="6" r="2" fill="#1e293b"/>
              <circle cx="80" cy="6" r="2" fill="#1e293b"/>
            </g>
            <g transform="translate(35, 10) rotate(8)">
              <rect x="0" y="4" width="50" height="70" rx="6" fill="#cbd5e1" />
              <rect x="-4" y="0" width="50" height="70" rx="6" fill="#fcfcfc" stroke="#e2e8f0" strokeWidth="2"/>
              <text x="21" y="48" fontFamily="sans-serif" fontWeight="900" fontSize="38" fill="#ef4444" textAnchor="middle">中</text>
            </g>
          </svg>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-amber-500/20 rounded-full blur-xl z-0"/>
        </div>
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
          {t('app.title')}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">{t('app.subtitle')}</p>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <button
          onClick={() => setPage('personal-menu')}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold
                     hover:from-amber-500 hover:to-orange-500 active:scale-[0.98] transition-all
                     shadow-lg shadow-amber-900/30 flex flex-col items-center gap-1"
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
