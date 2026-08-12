'use client';
import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import { getRepository } from '@/lib/repo-factory';
import { useAuthStore } from '@/lib/auth-store';
import type { DbCompletedSession } from '@/lib/repository';
import Avatar from '@/components/Avatar';
export default function RoomHistoryPage() {
  const { t } = useI18n();
  const { deviceId, viewingHistoryRoomId, setPage } = useGameStore();
  const { isPro: authIsPro, user } = useAuthStore();
  const [sessions, setSessions] = useState<DbCompletedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    if (!deviceId || !viewingHistoryRoomId) return;
    setLoading(true);
    getRepository().then((repo) => {
      repo.sessions.list(deviceId, viewingHistoryRoomId)
        .then((d) => { setSessions(d); setLoading(false); })
        .catch((err) => {
          console.error("Failed to load history:", err);
          alert("Network Error: Could not connect to database. " + err.message);
          setLoading(false);
        });
    }).catch((err) => {
      console.error("Failed to initialize repository:", err);
      setLoading(false);
    });
  }, [deviceId, viewingHistoryRoomId, authIsPro, user?.id]);

  // 手机熄屏/Safari后台冻结 → 亮屏时自动刷新数据
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === 'visible' && deviceId && viewingHistoryRoomId) {
        setLoading(true);
        getRepository().then((repo) => {
          repo.sessions.list(deviceId, viewingHistoryRoomId)
            .then((d) => { setSessions(d); setLoading(false); })
            .catch(() => setLoading(false));
        }).catch(() => setLoading(false));
      }
    };
    document.addEventListener('visibilitychange', onWake);
    return () => document.removeEventListener('visibilitychange', onWake);
  }, [deviceId, viewingHistoryRoomId]);

  return (
    <div className="min-h-dvh pt-safe-24 px-4 pb-8 page-enter">
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
            const rounds = s.sessionRounds ?? [];
            const players = s.sessionPlayers ?? [];
            const completedRounds = rounds.filter((r) => r.status === 'completed' && r.results);
            const ptMap: Record<string, number> = {};
            const nameMap: Record<string, string> = {};
            for (const r of completedRounds) {
              for (const res of (r.results ?? [])) {
                ptMap[res.player_id] = (ptMap[res.player_id] ?? 0) + res.pt;
                nameMap[res.player_id] = res.player_name;
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
                    <div className="space-y-1 mb-4">
                      {Object.entries(ptMap).sort(([, a], [, b]) => b - a).map(([pid, pt]) => {
                        const name = players.find((p) => p.player_id === pid)?.player_name ?? nameMap[pid] ?? '?';
                        const avatarSeed = players.find((p) => p.player_id === pid)?.avatar_seed ?? pid;
                        return (
                          <div key={pid} className="flex justify-between text-sm items-center">
                            <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                              <Avatar seed={avatarSeed} size={20} />
                              {name} <span className="text-[10px] text-zinc-400 font-mono ml-0.5">#{pid.substring(0, 4)}</span>
                            </span>
                            <span className={`font-mono font-bold ${pt >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{pt >= 0 ? '+' : ''}{pt.toFixed(1)}</span>
                          </div>
                        );
                      })}
                    </div>

                    {completedRounds.length > 0 && (
                      <>
                        <div className="font-medium text-xs text-zinc-500 mb-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">{t('history.roundDetails' as Parameters<typeof t>[0])}</div>
                        <div className="space-y-3">
                          {completedRounds.map((r) => (
                            <div key={r.id} className="bg-zinc-50 dark:bg-zinc-800/30 rounded-lg p-2 text-xs">
                              <div className="text-zinc-400 mb-1">{t('history.hanchan' as Parameters<typeof t>[0])} {r.round_number}</div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                {r.results?.map(res => {
                                  const name = players.find((p) => p.player_id === res.player_id)?.player_name ?? res.player_name;
                                  const avatarSeed = players.find((p) => p.player_id === res.player_id)?.avatar_seed ?? res.player_id;
                                  return (
                                    <div key={res.player_id} className="flex justify-between items-center">
                                      <span className="text-zinc-600 dark:text-zinc-400 truncate pr-2 flex items-center gap-1.5">
                                        <Avatar seed={avatarSeed} size={14} />
                                        {name}
                                      </span>
                                      <span className={`font-mono ${res.pt >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                        {res.pt >= 0 ? '+' : ''}{res.pt.toFixed(1)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
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
