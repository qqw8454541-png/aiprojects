'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/lib/auth-store';
import { Capacitor } from '@capacitor/core';
import { CheckCircle2, CloudFog, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export default function SyncScreen() {
  const { syncState, setSyncState } = useAuthStore();
  const { t } = useI18n();
  
  if (!syncState.isSyncing) return null;
  // If not native, don't show sync screen as Web is direct-to-cloud
  if (Capacitor.getPlatform() === 'web') return null;
  
  const p = syncState.progress;
  const isDone = p?.phase === 'done';
  const isError = p?.phase === 'error';
  const percent = p ? Math.min(100, Math.round((p.current / (p.total || 1)) * 100)) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-zinc-900/90 backdrop-blur-md flex items-center justify-center p-6"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center"
        >
          {isDone ? (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12 }}
                className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6"
              >
                <CheckCircle2 size={40} />
              </motion.div>
              <h2 className="text-2xl font-black mb-2 text-zinc-900 dark:text-zinc-100">
                {t('sync.doneTitle' as Parameters<typeof t>[0])}
              </h2>
              <p className="text-zinc-500 mb-8 font-medium">
                {t('sync.doneDesc1' as Parameters<typeof t>[0])}<br />
                {t('sync.doneDesc2' as Parameters<typeof t>[0])}
              </p>
              <button 
                onClick={() => setSyncState({ isSyncing: false, progress: null })}
                className="w-full py-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-2xl font-bold active:scale-95 transition-transform"
              >
                {t('sync.doneBtn' as Parameters<typeof t>[0])}
              </button>
            </>
          ) : isError ? (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 12 }}
                className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6"
              >
                <AlertTriangle size={40} />
              </motion.div>
              <h2 className="text-2xl font-black mb-2 text-zinc-900 dark:text-zinc-100">
                {t('sync.errorTitle' as Parameters<typeof t>[0])}
              </h2>
              <p className="text-zinc-500 mb-8 font-medium">
                {p.message || t('sync.errorDefault' as Parameters<typeof t>[0])}
                <br /><br />
                {t('sync.errorDesc' as Parameters<typeof t>[0])}
              </p>
              <button 
                onClick={() => setSyncState({ isSyncing: false, progress: null })}
                className="w-full py-4 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl font-bold active:scale-95 transition-transform"
              >
                {t('sync.errorBtn' as Parameters<typeof t>[0])}
              </button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-6 relative">
                <CloudFog size={40} className="animate-pulse" />
                <motion.div 
                  className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                />
              </div>
              
              <h2 className="text-2xl font-black mb-2 text-zinc-900 dark:text-zinc-100">
                {t('sync.syncingTitle' as Parameters<typeof t>[0])}
              </h2>
              
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-3 mb-3 overflow-hidden">
                <motion.div 
                  className="bg-blue-500 h-full rounded-full"
                  initial={{ width: "0%" }}
                  animate={{ width: `${percent}%` }}
                />
              </div>
              
              <div className="flex justify-between w-full text-xs font-bold text-zinc-400 mb-6 uppercase tracking-wider">
                <span>{percent}%</span>
                <span>{p?.current || 0} / {p?.total || 0}</span>
              </div>
              
              <p className="text-zinc-500 text-sm font-medium">
                {p?.message || t('sync.syncingDesc' as Parameters<typeof t>[0])}
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
