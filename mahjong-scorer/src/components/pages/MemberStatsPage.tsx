'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { supabase, authReady } from '@/lib/supabase';
import { listUserDeviceIds } from '@/lib/device-info';
import type { DbSavedMember, DbRoundPlayerResult } from '@/lib/repository';
import Avatar from '@/components/Avatar';
import RankChart from '@/components/RankChart';
import { calculateEvaluationPoint } from '@/lib/evaluation-point';
import { HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ── UI Components ──────────────────────────────────────────────

function Tooltip({ content, children, align = 'center' }: { content: string, children: React.ReactNode, align?: 'left' | 'center' | 'right' }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('click', handleClickOutside, { capture: true });
    return () => {
      document.removeEventListener('click', handleClickOutside, { capture: true });
    };
  }, [isOpen]);
  
  let alignClasses = "left-1/2 -translate-x-1/2";
  let arrowClasses = "left-1/2 -translate-x-1/2";
  
  if (align === 'left') {
    alignClasses = "left-[-8px]";
    arrowClasses = "left-[15px] -translate-x-1/2";
  } else if (align === 'right') {
    alignClasses = "right-[-8px]";
    arrowClasses = "right-[15px] translate-x-1/2";
  }

  return (
    <div 
      ref={containerRef}
      className="relative inline-flex items-center" 
      onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
    >
      {children}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className={`absolute bottom-full mb-2 w-[75vw] max-w-64 p-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-[11px] leading-relaxed rounded-xl shadow-xl z-[100] pointer-events-none text-left ${alignClasses}`}
          >
            {content}
            <div className={`absolute top-full -mt-1 border-4 border-transparent border-t-zinc-900 dark:border-t-zinc-100 ${arrowClasses}`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Lightweight types for direct queries ──────────────────────

interface MemberSession {
  sessionId: string;
  roomName: string;
  playedAt: string;
  playerId: string; // the in-session player_id for this member
  round: {
    id: string;
    roundNumber: number;
    startTime: number;
    endTime?: number;
    results: DbRoundPlayerResult[];
  };
  memberResult: DbRoundPlayerResult;
}

interface MemberEvalData {
  memberId: string;
  totalEvalPoint4: number;
  totalEvalPoint3: number;
  rank4: number;
  rank3: number;
}

// ── Direct Supabase queries (bypass heavy repo.sessions.list) ─

async function getDeviceFilter(deviceId: string): Promise<string[]> {
  await authReady;
  const { user, isPro } = useAuthStore.getState();
  if (user && isPro) {
    const ids = await listUserDeviceIds(user.id);
    return ids.length > 0 ? ids : [deviceId];
  }
  return [deviceId];
}

/** Query 1: Get Evaluation Point totals for all members */
async function fetchEvaluationRanking(deviceIds: string[]): Promise<Record<string, MemberEvalData>> {
  const sessQuery = supabase
    .from('completed_sessions')
    .select('id')
    .in('device_id', deviceIds);
  const { data: sessRows } = await sessQuery;
  if (!sessRows || sessRows.length === 0) return {};
  
  const sessionIds = sessRows.map((r: any) => r.id);
  
  const { data: players } = await supabase
    .from('session_players')
    .select('session_id, player_id, saved_member_id')
    .in('session_id', sessionIds)
    .not('saved_member_id', 'is', null);
  if (!players || players.length === 0) return {};
  
  const playerMemberMap: Record<string, Record<string, string>> = {};
  for (const p of players) {
    if (!p.saved_member_id) continue;
    if (!playerMemberMap[p.session_id]) playerMemberMap[p.session_id] = {};
    playerMemberMap[p.session_id][p.player_id] = p.saved_member_id;
  }
  
  const { data: rounds } = await supabase
    .from('session_rounds')
    .select('id, session_id, start_time')
    .in('session_id', sessionIds)
    .eq('status', 'completed');
  if (!rounds || rounds.length === 0) return {};
  
  const roundSessionMap: Record<string, string> = {};
  const roundTimeMap: Record<string, number> = {};
  const roundIds = rounds.map((r: any) => {
    roundSessionMap[r.id] = r.session_id;
    roundTimeMap[r.id] = Number(r.start_time);
    return r.id;
  });
  
  const allResults: any[] = [];
  const chunkSize = 500;
  for (let i = 0; i < roundIds.length; i += chunkSize) {
    const chunk = roundIds.slice(i, i + chunkSize);
    const { data: results } = await supabase
      .from('round_player_results')
      .select('round_id, player_id, raw_score, rank')
      .in('round_id', chunk);
    if (results) allResults.push(...results);
  }

  const roundPlayerCount: Record<string, number> = {};
  for (const r of allResults) {
    roundPlayerCount[r.round_id] = (roundPlayerCount[r.round_id] || 0) + 1;
  }

  const memberRounds: Record<string, {
    4: { rawScore: number; rank: number; time: number }[];
    3: { rawScore: number; rank: number; time: number }[];
  }> = {};

  for (const r of allResults) {
    const sessId = roundSessionMap[r.round_id];
    const memberId = playerMemberMap[sessId]?.[r.player_id];
    if (memberId) {
      const pCount = roundPlayerCount[r.round_id];
      if (pCount === 3 || pCount === 4) {
        if (!memberRounds[memberId]) {
          memberRounds[memberId] = { 4: [], 3: [] };
        }
        memberRounds[memberId][pCount as 3|4].push({
          rawScore: r.raw_score,
          rank: r.rank,
          time: roundTimeMap[r.round_id] || 0,
        });
      }
    }
  }

  const evalData: Record<string, MemberEvalData> = {};
  const ranks4: { memberId: string; pt: number }[] = [];
  const ranks3: { memberId: string; pt: number }[] = [];

  for (const [memberId, types] of Object.entries(memberRounds)) {
    let eval4 = 0;
    if (types[4].length > 0) {
      const sorted4 = types[4].sort((a, b) => a.time - b.time);
      const evalRounds4 = sorted4.map(r => ({ rawScore: r.rawScore, rank: r.rank, playerCount: 4 }));
      eval4 = calculateEvaluationPoint(evalRounds4, evalRounds4.length).totalPoint;
      ranks4.push({ memberId, pt: eval4 });
    }

    let eval3 = 0;
    if (types[3].length > 0) {
      const sorted3 = types[3].sort((a, b) => a.time - b.time);
      const evalRounds3 = sorted3.map(r => ({ rawScore: r.rawScore, rank: r.rank, playerCount: 3 }));
      eval3 = calculateEvaluationPoint(evalRounds3, evalRounds3.length).totalPoint;
      ranks3.push({ memberId, pt: eval3 });
    }

    evalData[memberId] = {
      memberId,
      totalEvalPoint4: eval4,
      totalEvalPoint3: eval3,
      rank4: 0,
      rank3: 0
    };
  }

  ranks4.sort((a, b) => b.pt - a.pt).forEach((r, idx) => {
    evalData[r.memberId].rank4 = idx + 1;
  });
  ranks3.sort((a, b) => b.pt - a.pt).forEach((r, idx) => {
    evalData[r.memberId].rank3 = idx + 1;
  });

  return evalData;
}

/** Query 2: Get only sessions where viewingMemberId participated (with full round detail) */
async function fetchMemberSessions(deviceIds: string[], memberId: string): Promise<MemberSession[]> {
  const { data: playerRows } = await supabase
    .from('session_players')
    .select('session_id, player_id')
    .eq('saved_member_id', memberId);
  if (!playerRows || playerRows.length === 0) return [];
  
  const sessionPlayerMap: Record<string, string> = {};
  const memberSessionIds = playerRows.map((p: any) => {
    sessionPlayerMap[p.session_id] = p.player_id;
    return p.session_id;
  });
  
  const { data: sessions } = await supabase
    .from('completed_sessions')
    .select(`
      id, room_name, played_at,
      session_rounds (
        id, round_number, status, start_time, end_time,
        round_player_results ( id, round_id, player_id, player_name, wind, raw_score, rank, pt )
      )
    `)
    .in('id', memberSessionIds)
    .in('device_id', deviceIds)
    .order('played_at', { ascending: false });
  
  if (!sessions) return [];
  
  const result: MemberSession[] = [];
  for (const sess of sessions) {
    const playerId = sessionPlayerMap[sess.id];
    const rounds = ((sess as any).session_rounds ?? [])
      .filter((r: any) => r.status === 'completed')
      .sort((a: any, b: any) => a.round_number - b.round_number);
    
    for (const rd of rounds) {
      const results: DbRoundPlayerResult[] = (rd.round_player_results ?? [])
        .sort((a: any, b: any) => a.rank - b.rank)
        .map((r: any) => ({ ...r, pt: Number(r.pt) }));
      
      const memberResult = results.find(r => r.player_id === playerId);
      if (!memberResult) continue;
      
      result.push({
        sessionId: sess.id,
        roomName: sess.room_name,
        playedAt: sess.played_at,
        playerId,
        round: {
          id: rd.id,
          roundNumber: rd.round_number,
          startTime: Number(rd.start_time),
          endTime: rd.end_time ? Number(rd.end_time) : undefined,
          results,
        },
        memberResult,
      });
    }
  }
  
  result.sort((a, b) => {
    const timeA = a.round.endTime || a.round.startTime || new Date(a.playedAt).getTime();
    const timeB = b.round.endTime || b.round.startTime || new Date(b.playedAt).getTime();
    return timeB - timeA;
  });
  
  return result;
}

// ── Component ─────────────────────────────────────────────────

export default function MemberStatsPage() {
  const { t, locale } = useI18n();
  const { deviceId, viewingMemberId } = useGameStore();
  const { isPro: authIsPro, user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<DbSavedMember | null>(null);
  const [evalRanks, setEvalRanks] = useState<Record<string, MemberEvalData>>({});
  const [matchHistory, setMatchHistory] = useState<MemberSession[]>([]);
  const [gameTypeTab, setGameTypeTab] = useState<'4-player' | '3-player'>('4-player');
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(10);

  useEffect(() => {
    if (!deviceId || !viewingMemberId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    (async () => {
      try {
        const deviceIds = await getDeviceFilter(deviceId);
        
        const [memberRow, ranking, sessions] = await Promise.all([
          supabase.from('saved_members').select('*').eq('id', viewingMemberId).single()
            .then(({ data }) => data as DbSavedMember | null),
          fetchEvaluationRanking(deviceIds),
          fetchMemberSessions(deviceIds, viewingMemberId),
        ]);
        
        if (memberRow) setMember(memberRow);
        setEvalRanks(ranking);
        setMatchHistory(sessions);
      } catch (err: any) {
        console.error("Failed to load member stats:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [deviceId, viewingMemberId, authIsPro, user?.id]);

  const stats = useMemo(() => {
    if (!viewingMemberId || !member) return null;

    const filteredHistory = matchHistory.filter(item => {
      const pCount = item.round.results.length;
      return gameTypeTab === '4-player' ? pCount === 4 : pCount === 3;
    });

    const rankData = evalRanks[viewingMemberId];
    let totalRank = 0;
    let rankTotalPlayers = 0;
    let totalEvalPt = 0;
    
    if (rankData) {
      if (gameTypeTab === '4-player') {
        totalRank = rankData.rank4;
        totalEvalPt = rankData.totalEvalPoint4;
        rankTotalPlayers = Object.values(evalRanks).filter(r => r.rank4 > 0).length;
      } else {
        totalRank = rankData.rank3;
        totalEvalPt = rankData.totalEvalPoint3;
        rankTotalPlayers = Object.values(evalRanks).filter(r => r.rank3 > 0).length;
      }
    }

    if (filteredHistory.length === 0) {
      return {
        isEmpty: true,
        pt: totalEvalPt,
        rank: totalRank,
        totalPlayers: rankTotalPlayers,
        totalGames: 0,
        maxScore: 0,
        minScore: 0,
        avgScore: 0,
        rankCounts: [0, 0, 0, 0],
        chartRounds: [],
        history: []
      };
    }
    
    let totalScore = 0;
    let maxScore = -Infinity;
    let minScore = Infinity;
    const rankCounts = [0, 0, 0, 0];
    
    const chronologicalRounds = [...filteredHistory].reverse();
    const evalInputRounds = chronologicalRounds.map(item => ({
      rawScore: item.memberResult.raw_score,
      rank: item.memberResult.rank,
      playerCount: item.round.results.length
    }));
    const evalData = calculateEvaluationPoint(evalInputRounds, evalInputRounds.length);
    
    const recent10 = chronologicalRounds.slice(-10);
    const chartRounds = recent10.map((item, idx) => {
      const globalIdx = chronologicalRounds.length - recent10.length + idx;
      const roundEvalPoint = evalData.roundPoints[globalIdx] || 0;
      
      return {
        id: item.round.id,
        roundNumber: idx + 1,
        results: [{
          playerId: viewingMemberId,
          playerName: member.name,
          wind: item.memberResult.wind as any,
          rawScore: item.memberResult.raw_score,
          rank: item.memberResult.rank,
          pt: roundEvalPoint
        }]
      };
    });

    for (const item of filteredHistory) {
      const r = item.memberResult;
      totalScore += r.raw_score;
      if (r.raw_score > maxScore) maxScore = r.raw_score;
      if (r.raw_score < minScore) minScore = r.raw_score;
      if (r.rank >= 1 && r.rank <= 4) rankCounts[r.rank - 1]++;
    }

    const totalGames = filteredHistory.length;
    const avgScore = totalGames > 0 ? Math.round(totalScore / totalGames) : 0;
    
    return {
      isEmpty: false,
      pt: totalEvalPt,
      rank: totalRank,
      totalPlayers: rankTotalPlayers,
      totalGames,
      maxScore: maxScore === -Infinity ? 0 : maxScore,
      minScore: minScore === Infinity ? 0 : minScore,
      avgScore,
      rankCounts,
      chartRounds,
      history: filteredHistory
    };
  }, [matchHistory, viewingMemberId, evalRanks, member, gameTypeTab]);

  if (loading) {
    return (
      <div className="min-h-dvh pt-24 px-4 pb-8 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-600 border-t-zinc-600 dark:border-t-zinc-300 rounded-full animate-spin" />
        <span className="text-sm text-zinc-400">Loading...</span>
      </div>
    );
  }

  if (!member || !stats) {
    return (
      <div className="min-h-dvh pt-24 px-4 pb-8 flex flex-col items-center justify-center text-center gap-3">
        <div className="text-5xl">📊</div>
        <p className="font-bold text-zinc-700 dark:text-zinc-300">{t('memberStats.noData' as any)}</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh pt-24 px-4 pb-8 page-enter space-y-4">
      


      {/* Card 1: Overview */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm relative">
        <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
        </div>
        
        {/* Top Row: Rank, Avatar/Name, PT */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col items-center justify-center min-w-[70px] relative">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-zinc-500 font-bold uppercase">{t('memberStats.ptRank' as any)}</span>
              <Tooltip content={t('memberStats.rankOf' as any)} align="left">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors" />
              </Tooltip>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100">
                {stats.rank > 0 ? `#${stats.rank}` : '-'}
              </span>
              {stats.rank > 0 && (
                <span className="text-xs text-zinc-500 font-bold whitespace-nowrap">
                  / {stats.totalPlayers}{locale === 'zh' || locale === 'ja' ? '人' : ''}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-center flex-1 mx-2">
            <Avatar seed={member.avatar_seed} size={72} className="shadow-md mb-3 ring-4 ring-zinc-50 dark:ring-zinc-800" />
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-xl text-zinc-900 dark:text-zinc-100 truncate max-w-[180px]">{member.name}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center justify-center min-w-[70px] relative">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-zinc-500 font-bold uppercase">{t('memberStats.evalPoint' as any)}</span>
              <Tooltip content={t('memberStats.evalPointTooltip' as any)} align="right">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-400 cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors" />
              </Tooltip>
            </div>
            <span className={`text-3xl font-black ${stats.pt >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {stats.pt > 0 ? '+' : ''}{stats.pt.toFixed(1)}
            </span>
          </div>
        </div>

        {stats.isEmpty ? (
          <div className="text-center text-zinc-400 py-6 text-sm">{t('memberStats.noData' as any)}</div>
        ) : (
          <>
            {/* Middle Row: Games, High, Low, Avg */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              <div className="flex flex-col items-center bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-xl">
                <span className="text-[10px] text-zinc-500 mb-1">{t('memberStats.totalGames' as any)}</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{stats.totalGames}</span>
              </div>
              <div className="flex flex-col items-center bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-xl">
                <span className="text-[10px] text-zinc-500 mb-1">{t('memberStats.highScore' as any)}</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{stats.maxScore}</span>
              </div>
              <div className="flex flex-col items-center bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-xl">
                <span className="text-[10px] text-zinc-500 mb-1">{t('memberStats.lowScore' as any)}</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{stats.minScore}</span>
              </div>
              <div className="flex flex-col items-center bg-zinc-50 dark:bg-zinc-800/50 p-2.5 rounded-xl">
                <span className="text-[10px] text-zinc-500 mb-1">{t('memberStats.avgScore' as any)}</span>
                <span className="font-bold text-zinc-900 dark:text-zinc-100">{stats.avgScore}</span>
              </div>
            </div>

            {/* Bottom Row: Rank Distribution */}
            <div className={`grid gap-2 ${gameTypeTab === '4-player' ? 'grid-cols-4' : 'grid-cols-3'}`}>
              {['🥇', '🥈', '🥉', '4️⃣'].slice(0, gameTypeTab === '4-player' ? 4 : 3).map((emoji, idx) => (
                <div key={idx} className="flex items-center justify-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-700/30">
                  <span className="text-sm">{emoji}</span>
                  <span className="font-bold text-sm text-zinc-700 dark:text-zinc-300">{stats.rankCounts[idx]}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full mx-auto max-w-[280px]">
        <button
          onClick={() => { setGameTypeTab('4-player'); setVisibleHistoryCount(10); }}
          className={`flex-1 text-sm font-bold py-1.5 rounded-full transition-all ${
            gameTypeTab === '4-player'
              ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          {t('memberStats.tab4Player' as any)}
        </button>
        <button
          onClick={() => { setGameTypeTab('3-player'); setVisibleHistoryCount(10); }}
          className={`flex-1 text-sm font-bold py-1.5 rounded-full transition-all ${
            gameTypeTab === '3-player'
              ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          {t('memberStats.tab3Player' as any)}
        </button>
      </div>

      {/* Card 2: Trend Chart */}
      {!stats.isEmpty && stats.chartRounds.length > 0 && viewingMemberId && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm relative">
          <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-4">{t('memberStats.recentTrend' as any)}</h2>
          <RankChart 
            rounds={stats.chartRounds}
            sortedPlayers={[[viewingMemberId, stats.pt]]}
            playerNamesMap={{ [viewingMemberId]: member.name }}
            playerId={viewingMemberId}
          />
        </div>
      )}

      {/* Card 3: Match History */}
      {!stats.isEmpty && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-4">{t('memberStats.matchHistory' as any)}</h2>
          <div className="space-y-4">
            {stats.history.slice(0, visibleHistoryCount).map((item) => {
              const time = item.round.endTime || item.round.startTime || new Date(item.playedAt).getTime();
              const dateStr = new Date(time).toLocaleString(locale === 'ja' ? 'ja-JP' : locale === 'zh' ? 'zh-CN' : 'en-US', {
                month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
              });
              
              const players = [...item.round.results].sort((a, b) => b.pt - a.pt);
              
              return (
                <div key={item.round.id} className="border-b border-zinc-100 dark:border-zinc-800 pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-xs text-zinc-600 dark:text-zinc-400 truncate pr-2 max-w-[60%]">
                      {item.roomName} 
                      <span className="ml-1.5 opacity-60 font-normal">Round {item.round.roundNumber}</span>
                    </div>
                    <div className="text-[10px] text-zinc-400 flex-shrink-0">
                      {dateStr}
                    </div>
                  </div>
                  
                  <div className={`grid gap-2 text-[10px] ${players.length === 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {players.map(p => {
                      const isMe = p.player_id === item.playerId;
                      return (
                        <div key={p.player_id} className={`flex justify-between p-1.5 rounded ${isMe ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800/50' : 'bg-zinc-50 dark:bg-zinc-800/40'}`}>
                          <span className={`truncate mr-1 ${isMe ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                            {p.player_name}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-zinc-400">{p.raw_score}</span>
                            <span className={`font-bold font-mono text-right ${p.pt >= 0 ? 'text-emerald-500' : 'text-red-500'} ${players.length === 3 ? 'w-6' : 'w-8'}`}>
                              {p.pt > 0 ? '+' : ''}{p.pt.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          
          {stats.history.length > visibleHistoryCount && (
            <button
              onClick={() => setVisibleHistoryCount(prev => prev + 10)}
              className="w-full mt-4 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              {t('memberStats.loadMore' as any)}
            </button>
          )}
        </div>
      )}
      
    </div>
  );
}
