import React from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useI18n } from '@/lib/i18n';

interface ProBlurOverlayProps {
  children: React.ReactNode;
  isPro: boolean;
  className?: string;
}

export function ProBlurOverlay({ children, isPro, className = '' }: ProBlurOverlayProps) {
  const { t } = useI18n();
  const openUpgradePrompt = useAuthStore((s) => s.openUpgradePrompt);

  if (isPro) {
    return <>{children}</>;
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* 底部内容（会被遮罩挡住一部分但能看出是数据） */}
      <div className="opacity-40 select-none pointer-events-none filter blur-[2px]">
        {children}
      </div>
      
      {/* 遮罩层 */}
      <div 
        className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/40 dark:bg-zinc-900/40 backdrop-blur-sm cursor-pointer transition-colors hover:bg-white/50 dark:hover:bg-zinc-900/50"
        onClick={() => openUpgradePrompt('pro')}
      >
        <div className="bg-white dark:bg-zinc-800 shadow-xl rounded-2xl p-4 flex flex-col items-center max-w-[200px] border border-zinc-200 dark:border-zinc-700">
          <span className="text-3xl mb-2">🔒</span>
          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 text-center">
            {t('memberStats.proBlurTitle' as Parameters<typeof t>[0])}
          </span>
          <button className="mt-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-2 px-4 rounded-xl w-full transition-colors">
            {t('upgrade.buyPro' as Parameters<typeof t>[0])}
          </button>
        </div>
      </div>
    </div>
  );
}
