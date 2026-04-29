'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import Avatar from '@/components/Avatar';
import type { Player } from '@/lib/store';

export default function RoomPage() {
  const { t } = useI18n();
  const {
    roomCode, roomName, rules, players, seats, rounds,
    addPlayer, removePlayer,
    rotateSeatsCW, shuffleSeats, swapSeats,
    startNewRound, viewRound, updatePlayer, resetScoresKeepPlayers,
    setPage, resetRoom, saveCurrentRoom, deviceId, addSavedPlayer
  } = useGameStore();
  const [nickname, setNickname] = useState('');
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editName, setEditName] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [savedMembers, setSavedMembers] = useState<import('@/lib/db').DbSavedMember[]>([]);

  useEffect(() => {
    if (!deviceId) return;
    import('@/lib/db').then(({ dbMembers }) => {
      dbMembers.list(deviceId).then(members => {
        const unique = [];
        const seen = new Set();
        for (const m of members) {
          if (!seen.has(m.name)) {
            seen.add(m.name);
            unique.push(m);
          }
        }
        setSavedMembers(unique);
      });
    });
  }, [deviceId]);

  const allSeated = seats.every((s) => s.playerId !== null);
  const currentlySeatedIds = seats.map(s => s.playerId).filter(Boolean);
  const unseatedPlayers = players.filter(p => !currentlySeatedIds.includes(p.id));

  function handleAddPlayer() {
    const name = nickname.trim();
    if (!name) return;
    if (players.some((p) => p.name === name)) {
      alert(t('room.duplicateName' as Parameters<typeof t>[0]));
      return;
    }
    addPlayer(name);
    setNickname('');
  }

  const WIND_EMOJI: Record<string, string> = {
    east: '🀀', south: '🀁', west: '🀂', north: '🀃',
  };
  const WIND_BG: Record<string, string> = {
    east: 'from-red-50 to-red-100/50 border-red-200 dark:from-red-900/60 dark:to-red-950/80 dark:border-red-700/50',
    south: 'from-emerald-50 to-emerald-100/50 border-emerald-200 dark:from-emerald-900/60 dark:to-emerald-950/80 dark:border-emerald-700/50',
    west: 'from-blue-50 to-blue-100/50 border-blue-200 dark:from-blue-900/60 dark:to-blue-950/80 dark:border-blue-700/50',
    north: 'from-purple-50 to-purple-100/50 border-purple-200 dark:from-purple-900/60 dark:to-purple-950/80 dark:border-purple-700/50',
  };

  return (
    <div className="min-h-dvh px-4 py-6 pt-24 page-enter">

      {/* Add player - can add to bench */}
      <div className="mb-5">
        <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder={`${t('room.enterNickname')} (${(rules?.mode === '3-player' ? [t('room.east' as Parameters<typeof t>[0]),t('room.south' as Parameters<typeof t>[0]),t('room.west' as Parameters<typeof t>[0])] : [t('room.east' as Parameters<typeof t>[0]),t('room.south' as Parameters<typeof t>[0]),t('room.west' as Parameters<typeof t>[0]),t('room.north' as Parameters<typeof t>[0])])[currentlySeatedIds.length]})`}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
              className="flex-1 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100
                         placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
              maxLength={10}
            />
            <button
              onClick={handleAddPlayer}
              disabled={!nickname.trim()}
              className="px-5 py-3 rounded-xl bg-amber-500 dark:bg-amber-600 text-white font-bold text-sm
                         hover:bg-amber-400 dark:hover:bg-amber-500 disabled:bg-zinc-200 dark:disabled:bg-zinc-700 disabled:text-zinc-400 dark:disabled:text-zinc-500 transition-all shadow-sm"
            >
              +
            </button>
          </div>
          
          {/* Quick Add from Saved Members */}
          {savedMembers.filter(m => !players.some(p => p.name === m.name)).length > 0 && (
            <div className="mt-3 mb-2">
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1.5 px-1">{t('room.historyMembers' as Parameters<typeof t>[0])}</p>
              <div className="flex flex-nowrap overflow-x-auto w-full gap-2 pb-2 scrollbar-hide">
                {savedMembers.filter(m => !players.some(p => p.name === m.name)).map(m => (
                  <button
                    key={m.id}
                    onClick={() => addSavedPlayer(m.id, m.name, m.avatar_seed)}
                    className="flex shrink-0 items-center gap-1.5 p-1.5 pr-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-full border border-indigo-100 dark:border-indigo-800/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 transition"
                  >
                    <Avatar seed={m.avatar_seed} size={24} />
                    <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Quick Add missing players (Bench) */}
          {unseatedPlayers.length > 0 && (
            <div className="mt-3 mb-2">
              <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1.5 px-1">{t('room.bench' as Parameters<typeof t>[0])}</p>
              <div className="flex flex-nowrap overflow-x-auto w-full gap-2 pb-2 scrollbar-hide">
                {unseatedPlayers.map((p) => {
                  // Find next vacant seat
                  const nextVacantSeat = seats.find(s => s.playerId === null);
                  return (
                    <div
                      key={p.id}
                      className="flex shrink-0 items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700 p-1 pl-1.5 transition"
                    >
                      <button
                        onClick={() => {
                          if (nextVacantSeat) useGameStore.getState().assignSeat(nextVacantSeat.wind, p.id);
                        }}
                        className="flex items-center gap-1.5"
                      >
                        <Avatar seed={p.avatarSeed} size={24} />
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300 pr-1">{p.name}</span>
                      </button>
                      <button 
                        onClick={() => removePlayer(p.id)} 
                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-100 dark:hover:bg-red-900/40 text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <span className="text-sm font-bold leading-none -mt-0.5">×</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
      </div>

      {/* Seat cards - visual display */}
      <div className="mb-5">
        <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">{t('room.seats')}</h3>
        <div className="grid grid-cols-2 gap-3">
          {seats.map((seat, idx) => {
            const player = players.find((p) => p.id === seat.playerId);
            const isSwapSelected = swapFrom === idx;
            return (
              <div
                key={seat.wind}
                onClick={() => {
                  if (!allSeated) return;
                  // Tap-to-swap
                  if (swapFrom === null) {
                    setSwapFrom(idx);
                  } else if (swapFrom === idx) {
                    setSwapFrom(null);
                  } else {
                    swapSeats(swapFrom, idx);
                    setSwapFrom(null);
                  }
                }}
                className={`
                  relative rounded-2xl border bg-gradient-to-br p-4 text-left transition-all
                  ${WIND_BG[seat.wind]}
                  ${isSwapSelected ? 'ring-2 ring-amber-400 scale-[1.03]' : ''}
                  ${allSeated ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'}
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{WIND_EMOJI[seat.wind]}</span>
                  <span className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                    {t(`room.${seat.wind}` as 'room.east' | 'room.south' | 'room.west' | 'room.north')}
                  </span>
                </div>
                <div className="h-6 relative">
                  <AnimatePresence mode="popLayout">
                    {player ? (
                      <motion.div
                        key={player.id}
                        layoutId={`player-${player.id}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                        className="flex items-center justify-between w-full"
                      >
                        <div 
                          className="flex items-center gap-2 flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPlayer(player);
                            setEditName(player.name);
                            setEditAvatar(player.avatarSeed);
                          }}
                        >
                          <Avatar seed={player.avatarSeed} size={28} />
                          <span className="text-sm sm:text-base font-medium text-amber-900 dark:text-amber-100 truncate hover:underline">{player.name}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            useGameStore.getState().assignSeat(seat.wind, null);
                          }}
                          className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 p-1 ml-1"
                        >
                          ✕
                        </button>
                      </motion.div>
                    ) : (
                      <motion.span
                        key="vacant"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-sm text-zinc-400 dark:text-zinc-600 italic block"
                      >
                        {t('room.vacant')}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Seat adjustment controls */}
      {allSeated && (
        <div className="mb-5 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => { rotateSeatsCW(); setSwapFrom(null); }}
              className="flex-1 py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-600/30 active:scale-[0.97] transition-all"
            >
              🔄 {t('score.rotateCW')}
            </button>
            <button
              onClick={() => { shuffleSeats(); setSwapFrom(null); }}
              className="flex-1 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-600/20 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-600/30 active:scale-[0.97] transition-all"
            >
              🎲 {t('score.shuffle')}
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-600 text-center">
            {swapFrom !== null ? t('room.swapActive' as Parameters<typeof t>[0]) : t('room.swapIdle' as Parameters<typeof t>[0])}
          </p>
        </div>
      )}

      {/* Start scoring button */}
      <button
        onClick={() => {
          const inProgress = rounds.find((r) => r.status === 'in_progress');
          if (inProgress) {
            setPage('score');
          } else {
            startNewRound();
          }
        }}
        disabled={!allSeated}
        className={`
          w-full py-4 rounded-2xl text-base font-bold transition-all
          ${
            allSeated
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600 text-white hover:brightness-110 active:scale-[0.98] shadow-lg shadow-emerald-900/10 dark:shadow-emerald-900/30'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
          }
        `}
      >
        {allSeated 
          ? (rounds.find(r => r.status === 'in_progress') ? t('room.continueMatch' as Parameters<typeof t>[0]) : t('room.startMatch' as Parameters<typeof t>[0])) 
          : (rules?.mode === '3-player' ? t('room.needThreePlayers' as Parameters<typeof t>[0]) : t('room.needFourPlayers' as Parameters<typeof t>[0]))}
      </button>

      {/* Round History */}
      {rounds.length > 0 && (
        <div className="mt-8 border-t border-zinc-200 dark:border-zinc-800 pt-6 mb-8">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">{t('room.history' as Parameters<typeof t>[0])}</h3>
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
            {rounds.map((r, index) => {
              const isInProgress = r.status === 'in_progress';
              return (
                <button
                  key={r.id || `round-${index}`}
                  onClick={() => {
                    if (isInProgress) {
                      setPage('score');
                    } else {
                      viewRound(r.id);
                    }
                  }}
                  className={`flex flex-col p-3 rounded-xl border transition-all text-left shadow-sm ${
                    isInProgress 
                      ? 'bg-amber-50 dark:bg-zinc-800/80 border-amber-200 dark:border-amber-900/30 hover:bg-amber-100 dark:hover:bg-zinc-800' 
                      : 'bg-white dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                      {t('score.round')} #{r.roundNumber}
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                      isInProgress ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                    }`}>
                      {isInProgress ? t('room.statusInProgress' as Parameters<typeof t>[0]) : t('room.statusCompleted' as Parameters<typeof t>[0])}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-500 font-mono">
                    {new Date(r.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {r.endTime && ` - ${new Date(r.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}



      {/* Generate Report Button */}
      {rounds.some(r => r.status === 'completed') && (
        <div className="mt-4 pb-0">
          <button
            onClick={() => setPage('report')}
            className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-600 dark:to-indigo-600 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20"
          >
            {t('result.generateReport' as Parameters<typeof t>[0])}
          </button>
        </div>
      )}

      {/* End Today Match Button */}
      {rounds.length > 0 && (
        <div className="mt-4 pb-8">
          <button
            onClick={async () => {
              if (confirm(t('room.confirmEndTodayMatch' as Parameters<typeof t>[0]))) {
                const limit = rules?.mode === '3-player' ? 3 : 4;
                const seatedPlayers = seats
                  .slice(0, limit)
                  .map((s) => players.find((p) => p.id === s.playerId))
                  .filter(Boolean);
                
                if (seatedPlayers.length === limit) {
                  const { dbRooms } = await import('@/lib/db');
                  const existingRooms = await dbRooms.list(deviceId);
                  const currentNames = [...players.map(p => p!.name)].sort();
                  
                  let isDuplicate = false;
                  for (const room of existingRooms) {
                    if (!room.members) continue;
                    const activeMembers = room.members.filter(m => m.avatar_seed !== '__DELETED__');
                    const roomNames = [...activeMembers.map(m => m.name)].sort();
                    if (currentNames.length > 0 && currentNames.length === roomNames.length && currentNames.every((name, i) => name === roomNames[i])) {
                      isDuplicate = true;
                      break;
                    }
                  }
                  
                  if (!isDuplicate) {
                    const defaultName = currentNames.join('、') + ' 的对局';
                    const newName = prompt(
                      '检测到这是一个新的玩家阵容。是否将其保存到「管理房间」中，方便下次一键开局？\n(如需保存请输入房间名，取消则不保存)',
                      defaultName
                    );
                    if (newName && newName.trim()) {
                      try {
                        await saveCurrentRoom(newName.trim());
                      } catch (e) {
                        console.error('Failed to auto-save room:', e);
                      }
                    }
                  }
                }

                resetRoom();
                setPage('personal-menu');
              }
            }}
            className="w-full py-4 rounded-xl font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 dark:hover:bg-rose-900/50 active:scale-[0.98] transition-all shadow-sm"
          >
            {t('room.endTodayMatch' as Parameters<typeof t>[0])}
          </button>
        </div>
      )}

      {/* Edit Player Modal */}
      <AnimatePresence>
        {editingPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditingPlayer(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-xl"
            >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{t('room.managePlayer' as Parameters<typeof t>[0])}</h3>
                <button
                  onClick={() => setEditingPlayer(null)}
                  className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 flex flex-col items-center">
                <div className="relative mb-6 group cursor-pointer" onClick={() => setEditAvatar(Math.random().toString(36).substring(2, 10))}>
                  <Avatar seed={editAvatar} size={96} className="ring-4 ring-amber-100 dark:ring-amber-900/30" />
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-white text-xs font-bold pointer-events-none">{t('room.randomAvatar' as Parameters<typeof t>[0])}</span>
                  </div>
                </div>
                
                <div className="w-full space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">{t('room.name' as Parameters<typeof t>[0])}</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  
                  <button
                    onClick={() => {
                      if (editName.trim()) {
                        updatePlayer(editingPlayer.id, editName.trim(), editAvatar);
                        setEditingPlayer(null);
                      }
                    }}
                    className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold transition shadow-sm"
                  >
                    {t('room.save' as Parameters<typeof t>[0])}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
