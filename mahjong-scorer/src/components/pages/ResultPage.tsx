'use client';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import type { Wind, PlayerScore, PlayerResult } from '@/lib/scoring';
import ResultCard from '@/components/ResultCard';
import type { Player } from '@/lib/store';

export default function ResultPage() {
  const { t } = useI18n();
  const { roomName, rounds, setPage, startNewRound, viewingRoundId } = useGameStore();

  const completedRounds = rounds.filter(
    (r): r is typeof r & { results: PlayerResult[] } => 
      r.status === 'completed' && !!r.results
  );
  
  const displayRound = viewingRoundId 
    ? completedRounds.find(r => r.id === viewingRoundId) 
    : completedRounds[completedRounds.length - 1];

  if (!displayRound) return null;

  // Calculate cumulative PT and historical names
  const cumulativePT: Record<string, number> = {};
  const playerNamesMap: Record<string, string> = {};
  for (const round of completedRounds) {
    if (!round.results) continue;
    for (const result of round.results) {
      playerNamesMap[result.playerId] = result.playerName;
      cumulativePT[result.playerId] = (cumulativePT[result.playerId] ?? 0) + result.pt;
    }
  }

  return (
    <div className="min-h-dvh px-4 py-6 pt-24 page-enter">

      {/* Current round result */}
      <ResultCard results={displayRound.results} roundNumber={displayRound.roundNumber} />

      {/* Cumulative PT */}
      {completedRounds.length > 1 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">{t('result.totalPt')}</h3>
          <div className="space-y-2">
            {Object.entries(cumulativePT)
              .sort(([, a], [, b]) => b - a)
              .map(([playerId, totalPt]) => {
                const playerName = playerNamesMap[playerId] ?? '?';
                return (
                  <div
                    key={playerId}
                    className="flex items-center justify-between rounded-xl bg-white/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 px-4 py-3 shadow-sm"
                  >
                    <span className="text-sm text-zinc-800 dark:text-zinc-300 font-medium">{playerName}</span>
                    <span
                      className={`font-mono font-bold ${
                        totalPt >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {totalPt >= 0 ? '+' : ''}
                      {totalPt < 0 ? '▲' : ''}
                      {Math.abs(Math.round(totalPt * 10) / 10).toFixed(1)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Round history */}
      {completedRounds.length > 1 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">{t('result.roundHistory')}</h3>
          <div className="space-y-2">
            {completedRounds.map((round) => {
              if (!round.results) return null;
              return (
              <div key={round.roundNumber} className="rounded-xl bg-zinc-100 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700/30 p-3">
                <div className="text-xs text-zinc-600 dark:text-zinc-500 mb-2 font-medium">
                  {t('score.round')} #{round.roundNumber}
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1 text-center text-xs">
                  {Object.keys(playerNamesMap).map((pId) => {
                    const r = round.results?.find(res => res.playerId === pId);
                    if (!r) {
                      return (
                        <div key={pId} className="opacity-50">
                          <div className="text-zinc-500 truncate font-medium">{playerNamesMap[pId]}</div>
                          <div className="font-mono text-[10px] mt-0.5">{t('room.bye' as Parameters<typeof t>[0])}</div>
                        </div>
                      );
                    }
                    return (
                      <div key={r.playerId}>
                        <div className="text-zinc-700 dark:text-zinc-500 truncate font-medium">{r.playerName}</div>
                        <div
                          className={`font-mono font-bold ${
                            r.pt >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                          }`}
                        >
                          {r.pt >= 0 ? '+' : ''}{r.pt.toFixed(1)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 space-y-3 pb-8">
        <button
          onClick={() => startNewRound()}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-base font-bold
                     hover:from-amber-500 hover:to-orange-500 active:scale-[0.98] transition-all"
        >
          {t('result.nextRound')}
        </button>
        <button
          onClick={() => setPage('room')}
          className="w-full py-3 rounded-2xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm font-medium
                     hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
        >
          {t('result.backToRoom')}
        </button>
      </div>
    </div>
  );
}
