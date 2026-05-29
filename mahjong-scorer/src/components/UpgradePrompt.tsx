'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/lib/auth-store';
import { PRICE_CONFIG } from '@/lib/billing.constants';
import { useState } from 'react';
import { hapticSuccess } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { Capacitor } from '@capacitor/core';
import { syncEngine } from '@/lib/sync-engine';

export default function UpgradePrompt() {
  const { t, locale } = useI18n();
  const {
    showUpgradePrompt,
    closeUpgradePrompt,
    upgradeToPro,
    isPro,
    setSyncState
  } = useAuthStore();
  const [purchasing, setPurchasing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const priceKey = (locale === 'ja' ? 'ja' : locale === 'zh' ? 'zh' : 'en') as keyof typeof PRICE_CONFIG.pro;
  const priceDisplay = PRICE_CONFIG.pro[priceKey];

  const handlePurchasePro = async () => {
    setPurchasing(true);
    
    try {
      const { user } = useAuthStore.getState();
      
      if (!user) {
        throw new Error('You must be logged in to upgrade.');
      }
      
      // Update the database (RLS currently allows public update for testing)
      // Use upsert to ensure it works even if the profile row doesn't exist yet
      const { error } = await supabase
        .from('profiles')
        .upsert(
          { 
            user_id: user.id, 
            tier: 'pro',
            display_name: user.user_metadata?.name || user.user_metadata?.full_name || ''
          },
          { onConflict: 'user_id' }
        );
        
      if (error) throw error;
      
      // Update the local state
      upgradeToPro();
      hapticSuccess();
      
      // Native sync trigger
      if (Capacitor.getPlatform() !== 'web') {
        setSyncState({ isSyncing: true, progress: null });
        syncEngine.fullSync((progress) => setSyncState({ progress })).then((res) => {
          if (!res.success) {
            console.error('Sync failed:', res.error);
          }
        });
      }

      setIsSuccess(true);
    } catch (e: any) {
      console.error('Upgrade failed:', e);
      // We still use alert here for simplicity since this is a temporary testing backdoor
      alert(t('upgrade.error' as any));
    } finally {
      setPurchasing(false);
    }
  };

  if (!showUpgradePrompt) return null;

  const features = [
    t('upgrade.feat1' as any),
    t('upgrade.feat2' as any),
    t('upgrade.feat3' as any),
    t('upgrade.feat4' as any),
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] glass-overlay flex items-center justify-center p-4"
        onClick={closeUpgradePrompt}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-xl"
        >
          {isSuccess ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 15 }}
              className="p-8 flex flex-col items-center justify-center text-center space-y-6"
            >
              <div className="relative mt-2">
                <motion.div 
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1, damping: 12 }}
                  className="w-24 h-24 bg-gradient-to-tr from-amber-400 to-yellow-300 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(251,191,36,0.6)]"
                >
                  <span className="text-5xl">👑</span>
                </motion.div>
                {/* Decorative sparkles */}
                {[...Array(6)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, x: 0, y: 0 }}
                    animate={{ 
                      scale: [0, 1, 0],
                      x: Math.cos(i * 60 * Math.PI / 180) * 70,
                      y: Math.sin(i * 60 * Math.PI / 180) * 70,
                    }}
                    transition={{ duration: 1.5, delay: 0.3 + i * 0.1, repeat: Infinity, repeatDelay: 1 }}
                    className="absolute top-1/2 left-1/2 w-2 h-2 bg-yellow-400 rounded-full"
                    style={{ marginLeft: -4, marginTop: -4 }}
                  />
                ))}
              </div>
              
              <div className="space-y-2">
                <motion.h3 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="font-black text-2xl bg-gradient-to-br from-amber-500 to-orange-500 bg-clip-text text-transparent"
                >
                  {t('upgrade.successTitle' as any) || 'Welcome to Pro!'}
                </motion.h3>
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-zinc-500 dark:text-zinc-400 text-sm font-medium"
                >
                  {t('upgrade.successDesc' as any) || 'All premium features are now unlocked.'}
                </motion.p>
              </div>

              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                onClick={() => {
                  setIsSuccess(false);
                  closeUpgradePrompt();
                }}
                className="w-full mt-4 py-4 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all active:scale-[0.97] shadow-lg"
              >
                {t('common.confirm' as any) || 'Start Exploring'}
              </motion.button>
            </motion.div>
          ) : (
            <div className="p-6">
            {/* Header */}
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">⭐</div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">
                {t('upgrade.proTitle' as Parameters<typeof t>[0]) || 'Upgrade to Pro'}
              </h3>
              <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">
                {priceDisplay}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {t('upgrade.subscription' as Parameters<typeof t>[0]) || 'Monthly subscription, cancel anytime'}
              </p>
            </div>

            {/* Feature List */}
            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-4 space-y-2.5 mb-5">
              {features.map((f, i) => (
                <p key={i} className="text-sm text-zinc-700 dark:text-zinc-300 font-medium">
                  {f}
                </p>
              ))}
            </div>

            {/* Purchase Button */}
            <button
              onClick={handlePurchasePro}
              disabled={purchasing || isPro}
              className={`w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.97] ${
                isPro
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-900/20 hover:brightness-110'
              }`}
            >
              {isPro
                ? (t('upgrade.alreadyPro' as Parameters<typeof t>[0]) || '🎖️ Already Pro')
                : purchasing
                  ? '...'
                  : (t('upgrade.buyPro' as Parameters<typeof t>[0]) || `Subscribe to Pro — ${priceDisplay}`)
              }
            </button>

            {/* Close */}
            <button
              onClick={closeUpgradePrompt}
              className="w-full mt-3 py-3 rounded-xl text-zinc-500 dark:text-zinc-400 font-medium text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
            >
              {t('common.close')}
            </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
