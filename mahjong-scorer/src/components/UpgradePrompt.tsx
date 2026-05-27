'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { useAuthStore } from '@/lib/auth-store';
import { PRICE_CONFIG } from '@/lib/billing.constants';
import { useState } from 'react';
import { hapticSuccess } from '@/lib/haptics';

export default function UpgradePrompt() {
  const { t, locale } = useI18n();
  const {
    showUpgradePrompt,
    closeUpgradePrompt,
    upgradeToPro,
    isPro,
  } = useAuthStore();
  const [purchasing, setPurchasing] = useState(false);

  const priceKey = (locale === 'ja' ? 'ja' : locale === 'zh' ? 'zh' : 'en') as keyof typeof PRICE_CONFIG.pro;
  const priceDisplay = PRICE_CONFIG.pro[priceKey];

  const handlePurchasePro = async () => {
    setPurchasing(true);
    // TODO: Replace with real IAP / Stripe subscription flow
    await new Promise((r) => setTimeout(r, 1000));
    upgradeToPro();
    hapticSuccess();
    setPurchasing(false);
    closeUpgradePrompt();
  };

  if (!showUpgradePrompt) return null;

  const proFeatures: Record<string, string[]> = {
    ja: [
      '✨ AI戦報レビュー — 無制限',
      '☁️ クラウド同期 & マルチデバイス',
      '📊 高度な統計データ（今後追加）',
      '🚀 優先サポート',
    ],
    zh: [
      '✨ AI 战报点评 — 无限次',
      '☁️ 云端同步 & 多设备漫游',
      '📊 高级数据图表（后续扩展）',
      '🚀 优先客服支持',
    ],
    en: [
      '✨ AI Game Reviews — Unlimited',
      '☁️ Cloud Sync & Multi-device',
      '📊 Advanced Analytics (coming soon)',
      '🚀 Priority Support',
    ],
  };

  const features = proFeatures[locale] || proFeatures.en;

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
              disabled={purchasing || isPro()}
              className={`w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.97] ${
                isPro()
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-900/20 hover:brightness-110'
              }`}
            >
              {isPro()
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
