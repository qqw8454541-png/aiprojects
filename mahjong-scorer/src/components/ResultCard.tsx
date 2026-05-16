'use client';

import { useI18n } from '@/lib/i18n';
import type { PlayerResult } from '@/lib/scoring';

interface ResultCardProps {
  results: PlayerResult[];
  roundNumber: number;
}

// Rank decorations — styled badges instead of emojis for cross-platform support.
// Medal emojis 🥇🥈🥉 may not render on some Android WebView versions.
const RANK_BADGE_COLORS = [
  'bg-amber-500 text-white',   // 1st - gold
  'bg-zinc-400 text-white',    // 2nd - silver
  'bg-orange-700 text-white',  // 3rd - bronze
  'bg-zinc-600 text-white',    // 4th
];

export default function ResultCard({ results, roundNumber }: ResultCardProps) {
  const { t } = useI18n();

  const champion = results[0];

  return (
    <div className="space-y-4">
      {/* Champion highlight */}
      <div className="text-center py-4 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-100 dark:from-amber-900/30 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-600/30 shadow-sm">
        <div className="text-3xl mb-1">👑</div>
        <div className="text-xl font-bold text-amber-700 dark:text-amber-300">{champion.playerName}</div>
        <div className="text-sm text-amber-600 dark:text-amber-400/80 mt-1 font-medium">
          {t('result.champion')}
        </div>
        <div className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-2">
          +{champion.pt.toFixed(1)}
        </div>
      </div>

      {/* Results table */}
      <div className="space-y-2">
        {results.map((result, index) => (
          <div
            key={result.playerId}
            className={`
              flex items-center gap-3 rounded-xl border p-3
              ${index === 0 ? 'bg-gradient-to-r from-amber-50 to-amber-100/50 border-amber-200 dark:from-amber-500/20 dark:to-yellow-600/10 dark:border-amber-500/60'
                : index === 1 ? 'bg-gradient-to-r from-zinc-50 to-zinc-100/50 border-zinc-200 dark:from-zinc-400/10 dark:to-zinc-500/5 dark:border-zinc-400/40'
                : index === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-100/50 border-orange-200 dark:from-orange-800/10 dark:to-orange-900/5 dark:border-orange-700/30'
                : 'bg-gradient-to-r from-zinc-100 to-zinc-50/50 border-zinc-200 dark:from-zinc-800/10 dark:to-zinc-900/5 dark:border-zinc-700/20'
              }
              transition-all
            `}
          >
            {/* Rank */}
            <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-lg font-black ${RANK_BADGE_COLORS[index] || 'bg-zinc-600 text-white'}`}>
              {index + 1}
            </div>

            {/* Player info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                {result.playerName}
              </div>
              <div className="text-xs text-zinc-500 font-mono">
                {result.rawScore.toLocaleString()}
              </div>
            </div>

            {/* PT */}
            <div
              className={`text-lg font-mono font-bold flex-shrink-0 ${
                result.pt >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
              }`}
            >
              {result.pt >= 0 ? '+' : ''}
              {result.pt < 0 ? '▲' : ''}
              {Math.abs(result.pt).toFixed(1)}
            </div>
          </div>
        ))}
      </div>

      {/* Round indicator */}
      <div className="text-center text-xs text-zinc-500 dark:text-zinc-600">
        {t('score.round')} #{roundNumber}
      </div>
    </div>
  );
}
