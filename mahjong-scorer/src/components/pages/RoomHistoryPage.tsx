'use client';
import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import type { Player } from '@/lib/store';

export default function RoomHistoryPage() {
  const { t } = useI18n();
  const { deviceId, viewingHistoryRoomId, setPage } = useGameStore();
  const [sessions, setSessions] = useState<import('@/lib/db').DbCompletedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    if (!deviceId || !viewingHistoryRoomId) return;
    import('@/lib/db').then(({ dbSessions }) => {
      dbSessions.list(deviceId, viewingHistoryRoomId)
        .then((d) => { setSessions(d); setLoading(false); })
        .catch((err) => {
          console.error("Failed to load history:", err);
          alert("Network Error: Could not connect to database. " + err.message);
          setLoading(false);
        });
    }).catch((err) => {
      console.error("Failed to import db:", err);
      setLoading(false);
    });
  }, [deviceId, viewingHistoryRoomId]);

  return (
    <div className="min-h-dvh pt-24 px-4 pb-8 page-enter">
      {loading ? (
        <div className="flex justify-center py-20 text-zinc-400">Loading...</div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <div className="text-5xl">📊</div>
          <p className="font-bold text-zinc-700 dark:text-zinc-300">{t('history.noSessions')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s, idx) => {
            const rounds = s.rounds as import('@/lib/store').RoundResult[];
            const players = s.players as import('@/lib/store').Player[];
            const completedRounds = rounds.filter((r) => r.status === 'completed' && r.results);
            const ptMap: Record<string, number> = {};
            const nameMap: Record<string, string> = {};
            for (const r of completedRounds) {
              for (const res of (r.results ?? [])) {
                ptMap[res.playerId] = (ptMap[res.playerId] ?? 0) + res.pt;
                nameMap[res.playerId] = res.playerName;
              }
            }
            const isOpen = expanded.includes(s.id);
            return (
              <div key={s.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <button className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition" onClick={() => setExpanded(prev => prev.includes(s.id) ? prev.filter(x => x !== s.id) : [...prev, s.id])}>
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">{t('history.session')} #{sessions.length - idx}</div>
                    <div className="text-xs text-zinc-500">{new Date(s.played_at).toLocaleDateString()} · {completedRounds.length} {t('history.hanchan')}</div>
                  </div>
                  <span className="text-zinc-400">{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                    <div className="font-medium text-xs text-zinc-500 mb-2">{t('history.totalPt')}</div>
                    <div className="space-y-1">
                      {Object.entries(ptMap).sort(([, a], [, b]) => b - a).map(([pid, pt]) => {
                        const name = players.find((p) => p.id === pid)?.name ?? nameMap[pid] ?? '?';
                        return (
                          <div key={pid} className="flex justify-between text-sm items-center">
                            <span className="text-zinc-700 dark:text-zinc-300">
                              {name} <span className="text-[10px] text-zinc-400 font-mono ml-0.5">#{pid.substring(0, 4)}</span>
                            </span>
                            <span className={`font-mono font-bold ${pt >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{pt >= 0 ? '+' : ''}{pt.toFixed(1)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
