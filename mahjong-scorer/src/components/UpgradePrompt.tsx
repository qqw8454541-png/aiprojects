'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/lib/auth-store';

import { useState, useEffect } from 'react';
import { hapticSuccess } from '@/lib/haptics';
import { Capacitor } from '@capacitor/core';
import { syncEngine } from '@/lib/sync-engine';
import { billingService } from '@/lib/billing-service';

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
  const [restoring, setRestoring] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // 从商店动态获取价格，未取到时 fallback 到翻译文件的硬编码价格
  const [storePrice, setStorePrice] = useState<string | null>(null);
  useEffect(() => {
    if (showUpgradePrompt && billingService.isNative) {
      let timer: any;
      let mounted = true;

      const fetchPrice = () => {
        const price = billingService.getLocalizedPrice();
        if (price && mounted) {
          setStorePrice(price);
          clearInterval(timer);
        }
      };

      // Ensure SDK is initialized before trying to fetch price
      billingService.init().then(() => {
        if (!mounted) return;
        fetchPrice(); // Try immediately
        timer = setInterval(fetchPrice, 1000); // Poll every second if not yet loaded
      });
      
      return () => {
        mounted = false;
        clearInterval(timer);
      };
    }
  }, [showUpgradePrompt]);

  const isWeb = Capacitor.getPlatform() === 'web';
  
  let priceDisplay: React.ReactNode;
  if (isWeb) {
    priceDisplay = <span className="text-xl">―</span>;
  } else if (storePrice) {
    priceDisplay = storePrice;
  } else {
    priceDisplay = (
      <span className="inline-block w-32 h-8 bg-amber-200/50 dark:bg-amber-900/50 rounded-lg animate-pulse" />
    );
  }

  const handlePurchasePro = async () => {
    setPurchasing(true);

    try {
      const { user } = useAuthStore.getState();

      if (!user) {
        throw new Error('You must be logged in to upgrade.');
      }

      // 原生平台：通过 billing SDK 发起真实购买
      const result = await billingService.purchasePro();

      if (!result.success) {
        if (result.error === 'user_cancelled') {
          // 用户主动取消 — 静默处理，不弹错误提示
          return;
        }
        throw new Error(result.message || result.error || 'Purchase failed');
      }

      // SDK 购买成功且已验证 — 更新本地状态
      upgradeToPro();
      hapticSuccess();

      // 原生端触发同步
      if (Capacitor.getPlatform() !== 'web') {
        setSyncState({ isSyncing: true, progress: null });
        syncEngine.fullSync((progress) => setSyncState({ progress })).then((res) => {
          if (!res.success) {
            console.error('Sync failed:', res.error);
          }
          setSyncState({ isSyncing: false, progress: null });
        });
      }

      setIsSuccess(true);
    } catch (e: any) {
      console.error('Upgrade failed:', e);
      // TODO(security): 不要在生产环境使用 alert()，应改为框架内 Toast/Modal 组件
      alert(t('upgrade.error' as Parameters<typeof t>[0]));
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const restored = await billingService.restorePurchases();
      if (restored) {
        upgradeToPro();
        hapticSuccess();
        setIsSuccess(true);
      } else {
        alert(t('upgrade.restoreNone' as Parameters<typeof t>[0]));
      }
    } catch (e) {
      console.error('Restore failed:', e);
      alert(t('upgrade.restoreError' as Parameters<typeof t>[0]));
    } finally {
      setRestoring(false);
    }
  };


  if (!showUpgradePrompt) return null;

  const features = [
    t('upgrade.feat1' as Parameters<typeof t>[0]),
    t('upgrade.feat2' as Parameters<typeof t>[0]),
    t('upgrade.feat3' as Parameters<typeof t>[0]),
    t('upgrade.feat4' as Parameters<typeof t>[0]),
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
                  {t('upgrade.successTitle' as Parameters<typeof t>[0])}
                </motion.h3>
                <motion.p 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-zinc-500 dark:text-zinc-400 text-sm font-medium"
                >
                  {t('upgrade.successDesc' as Parameters<typeof t>[0])}
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
                {t('common.confirm' as Parameters<typeof t>[0])}
              </motion.button>
            </motion.div>
          ) : (
            <div className="p-6">
            {/* Header */}
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">⭐</div>
              <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">
                {t('upgrade.proTitle' as Parameters<typeof t>[0])}
              </h3>
              <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-2">
                {priceDisplay}
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                {t('upgrade.subscriptionDesc' as Parameters<typeof t>[0])}
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

            {/* Web 平台提示 */}
            {isWeb && !isPro && (
              <p className="text-xs text-center text-zinc-400 dark:text-zinc-500 mb-3">
                {t('upgrade.webOnly' as Parameters<typeof t>[0])}
              </p>
            )}

            {/* Purchase Button */}
            <button
              onClick={handlePurchasePro}
              disabled={purchasing || isPro || isWeb}
              className={`w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.97] ${
                isPro
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                  : isWeb
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-900/20 hover:brightness-110'
              }`}
            >
              {isPro ? (
                t('upgrade.alreadyPro' as Parameters<typeof t>[0])
              ) : purchasing ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {t('subscription.canceling' as Parameters<typeof t>[0])}
                </>
              ) : (
                t('upgrade.buyPro' as Parameters<typeof t>[0])
              )}
            </button>

            {/* Restore Purchases — App Store 审核强制要求 */}
            {!isPro && !isWeb && (
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="w-full mt-2 py-2.5 rounded-xl text-amber-600 dark:text-amber-400 font-medium text-sm hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all"
              >
                {restoring ? '...' : t('upgrade.restore' as Parameters<typeof t>[0])}
              </button>
            )}

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
