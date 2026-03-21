'use client';

import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import type { Wind } from '@/lib/scoring';

interface ScoreDisplayProps {
  inputValue: string; // abbreviated value as string (e.g. "355", "-12")
  playerName: string;
  playerId?: string;
  wind: Wind;
  isActive: boolean;
  isAutoCalc: boolean;
}

const WIND_LABELS: Record<string, Record<Wind, string>> = {
  ja: { east: '東', south: '南', west: '西', north: '北' },
  zh: { east: '东', south: '南', west: '西', north: '北' },
  en: { east: 'E', south: 'S', west: 'W', north: 'N' },
};

const WIND_COLORS: Record<Wind, string> = {
  east: 'bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-500/50',
  south: 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-500/50',
  west: 'bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-500/50',
  north: 'bg-purple-50 dark:bg-purple-900/40 border-purple-200 dark:border-purple-500/50',
};

export function formatScoreDisplay(input: string): { main: string; suffix: string } {
  if (!input || input === '' || input === '-') {
    return { main: input || '0', suffix: '00' };
  }

  const isNegative = input.startsWith('-');
  const absValue = isNegative ? input.slice(1) : input;

  if (!absValue) {
    return { main: '-', suffix: '00' };
  }

  // Input is abbreviated (×100). e.g. 355 = 35,500 actual points
  // Display: format the full value (input * 100) with commas,
  // but show trailing "00" in gray.
  const num = parseInt(absValue, 10);
  if (isNaN(num)) {
    return { main: isNegative ? `-${absValue}` : absValue, suffix: '00' };
  }

  // Build the full number string (without the trailing 00)
  // Then format with comma: e.g. 355 → "35,5" + "00"
  // Full value = num * 100, e.g. 35500
  const fullValue = num * 100;
  const fullStr = fullValue.toLocaleString('en-US');
  // The main part is everything except last 2 chars, suffix is last 2
  const mainPart = fullStr.slice(0, -2);
  const suffixPart = fullStr.slice(-2);

  const sign = isNegative ? '-' : '';
  return { main: `${sign}${mainPart}`, suffix: suffixPart };
}

export default function ScoreDisplay({
  inputValue,
  playerName,
  playerId,
  wind,
  isActive,
  isAutoCalc,
}: ScoreDisplayProps) {
  const { locale } = useI18n();
  const { t } = useI18n();
  const windLabel = WIND_LABELS[locale]?.[wind] ?? WIND_LABELS.en[wind];
  const { main, suffix } = formatScoreDisplay(inputValue);

  return (
    <div
      className={`
        relative rounded-xl border-2 p-3 transition-all
        ${WIND_COLORS[wind]}
        ${isActive ? 'ring-2 ring-amber-400 scale-[1.02]' : 'opacity-80'}
      `}
    >
      {/* Wind badge */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {windLabel}
        </span>
        {isAutoCalc && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-medium">
            {t('score.autoCalc')}
          </span>
        )}
      </div>

      {/* Player name */}
      <div className="h-5 relative w-full overflow-hidden mt-0.5">
        <AnimatePresence mode="popLayout">
          {playerName && playerName !== '?' ? (
            <motion.div
              key={playerId || playerName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="text-sm font-medium text-zinc-800 dark:text-zinc-300 truncate w-full absolute inset-0"
            >
              {playerName}
            </motion.div>
          ) : (
            <div className="text-sm font-medium text-zinc-400 dark:text-zinc-500 truncate absolute inset-0">?</div>
          )}
        </AnimatePresence>
      </div>

      {/* Score display */}
      <div className="mt-1 text-right font-mono">
        <span className="text-2xl font-bold text-zinc-900 dark:text-white">{main}</span>
        <span className="text-2xl text-zinc-400 dark:text-zinc-600">{suffix}</span>
      </div>
    </div>
  );
}
