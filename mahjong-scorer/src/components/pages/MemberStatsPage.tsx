'use client';
import { useState, useEffect, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { supabase, authReady } from '@/lib/supabase';
import { listUserDeviceIds } from '@/lib/device-info';
import type { DbSavedMember, DbSessionRound, DbRoundPlayerResult } from '@/lib/repository';
import Avatar from '@/components/Avatar';
import RankChart from '@/components/RankChart';

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

interface PtRankEntry {
  memberId: string;
  totalPt: number;
  rank: number;
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

/** Query 1: Get PT totals for all members (lightweight — no full session data) */
async function fetchPtRanking(deviceIds: string[]): Promise<Record<string, PtRankEntry>> {
  // Get all session_players for these devices, with their round results
  // Join: session_players → completed_sessions (for device filter)
  //       session_players.player_id → round_player_results.player_id (matched via round's session)
  
  // Step A: Get all session IDs for these devices
  let sessQuery = supabase
    .from('completed_sessions')
    .select('id')
    .in('device_id', deviceIds);
  const { data: sessRows } = await sessQuery;
  if (!sessRows || sessRows.length === 0) return {};
  
  const sessionIds = sessRows.map((r: any) => r.id);
  
  // Step B: Get all session_players with saved_member_id
  const { data: players } = await supabase
    .from('session_players')
    .select('session_id, player_id, saved_member_id')
    .in('session_id', sessionIds)
    .not('saved_member_id', 'is', null);
  if (!players || players.length === 0) return {};
  
  // Build player_id → saved_member_id map per session
  const playerMemberMap: Record<string, Record<string, string>> = {};
  for (const p of players) {
    if (!p.saved_member_id) continue;
    if (!playerMemberMap[p.session_id]) playerMemberMap[p.session_id] = {};
    playerMemberMap[p.session_id][p.player_id] = p.saved_member_id;
  }
  
  // Step C: Get all round IDs for these sessions
  const { data: rounds } = await supabase
    .from('session_rounds')
    .select('id, session_id')
    .in('session_id', sessionIds)
    .eq('status', 'completed');
  if (!rounds || rounds.length === 0) return {};
  
  const roundSessionMap: Record<string, string> = {};
  const roundIds = rounds.map((r: any) => {
    roundSessionMap[r.id] = r.session_id;
    return r.id;
  });
  
  // Step D: Get all results — batch in chunks of 500 to avoid URL length limits
  const ptMap: Record<string, number> = {};
  const chunkSize = 500;
  for (let i = 0; i < roundIds.length; i += chunkSize) {
    const chunk = roundIds.slice(i, i + chunkSize);
    const { data: results } = await supabase
      .from('round_player_results')
      .select('round_id, player_id, pt')
      .in('round_id', chunk);
    
    for (const r of results || []) {
      const sessId = roundSessionMap[r.round_id];
      const memberId = playerMemberMap[sessId]?.[r.player_id];
      if (memberId) {
        ptMap[memberId] = (ptMap[memberId] || 0) + Number(r.pt);
      }
    }
  }
  
  // Sort and assign ranks
  const sorted = Object.entries(ptMap).sort(([, a], [, b]) => b - a);
  const ranks: Record<string, PtRankEntry> = {};
  sorted.forEach(([id, pt], idx) => {
    ranks[id] = { memberId: id, totalPt: pt, rank: idx + 1 };
  });
  return ranks;
}

/** Query 2: Get only sessions where viewingMemberId participated (with full round detail) */
async function fetchMemberSessions(deviceIds: string[], memberId: string): Promise<MemberSession[]> {
  // Step A: Find session_players rows for this member
  const { data: playerRows } = await supabase
    .from('session_players')
    .select('session_id, player_id')
    .eq('saved_member_id', memberId);
  if (!playerRows || playerRows.length === 0) return [];
  
  // Map: session_id → player_id (the in-session ID for this member)
  const sessionPlayerMap: Record<string, string> = {};
  const memberSessionIds = playerRows.map((p: any) => {
    sessionPlayerMap[p.session_id] = p.player_id;
    return p.session_id;
  });
  
  // Step B: Fetch those sessions with nested rounds + results in ONE query
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
  
  // Sort by time descending
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
  const [ptRanks, setPtRanks] = useState<Record<string, PtRankEntry>>({});
  const [matchHistory, setMatchHistory] = useState<MemberSession[]>([]);

  useEffect(() => {
    if (!deviceId || !viewingMemberId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    (async () => {
      try {
        const deviceIds = await getDeviceFilter(deviceId);
        
        // 3 parallel queries — each is lightweight and targeted
        const [memberRow, ranking, sessions] = await Promise.all([
          // Q1: Member info (single row)
          supabase.from('saved_members').select('*').eq('id', viewingMemberId).single()
            .then(({ data }) => data as DbSavedMember | null),
          // Q2: PT ranking (aggregate, no full session payloads)
          fetchPtRanking(deviceIds),
          // Q3: Only this member's sessions (filtered server-side)
          fetchMemberSessions(deviceIds, viewingMemberId),
        ]);
        
        if (memberRow) setMember(memberRow);
        setPtRanks(ranking);
        setMatchHistory(sessions);
      } catch (err: any) {
        console.error("Failed to load member stats:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [deviceId, viewingMemberId, authIsPro, user?.id]);

  // Compute stats from loaded data
  const stats = useMemo(() => {
    if (!viewingMemberId || matchHistory.length === 0) return null;
    
    let totalScore = 0;
    let maxScore = -Infinity;
    let minScore = Infinity;
    const rankCounts = [0, 0, 0, 0];
    
    for (const item of matchHistory) {
      const r = item.memberResult;
      totalScore += r.raw_score;
      if (r.raw_score > maxScore) maxScore = r.raw_score;
      if (r.raw_score < minScore) minScore = r.raw_score;
      if (r.rank >= 1 && r.rank <= 4) rankCounts[r.rank - 1]++;
    }

    const totalGames = matchHistory.length;
    const avgScore = totalGames > 0 ? Math.round(totalScore / totalGames) : 0;
    const ptData = ptRanks[viewingMemberId] || { totalPt: 0, rank: Object.keys(ptRanks).length + 1 };
    
    // Recent 10 for chart (chronological order)
    const recent10 = matchHistory.slice(0, 10).reverse();
    const chartRounds = recent10.map((item, idx) => ({
      id: item.round.id,
      roundNumber: idx + 1,
      results: [{
        playerId: viewingMemberId,
        playerName: member?.name || '',
        wind: item.memberResult.wind as any,
        rawScore: item.memberResult.raw_score,
        rank: item.memberResult.rank,
        pt: item.memberResult.pt
      }]
    }));

    return {
      pt: ptData.totalPt,
      rank: ptData.rank,
      totalGames,
      maxScore: maxScore === -Infinity ? 0 : maxScore,
      minScore: minScore === Infinity ? 0 : minScore,
      avgScore,
      rankCounts,
      chartRounds
    };
  }, [matchHistory, viewingMemberId, ptRanks, member]);

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
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
        
        {/* Top Row: Rank, Avatar/Name, PT */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col items-center justify-center min-w-[60px]">
            <span className="text-xs text-zinc-500 font-bold uppercase mb-1">{t('memberStats.ptRank' as any)}</span>
            <span className="text-3xl font-black text-zinc-900 dark:text-zinc-100">#{stats.rank}</span>
          </div>
          
          <div className="flex flex-col items-center flex-1 mx-2">
            <Avatar seed={member.avatar_seed} size={72} className="shadow-md mb-3 ring-4 ring-zinc-50 dark:ring-zinc-800" />
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-xl text-zinc-900 dark:text-zinc-100 truncate max-w-[200px]">{member.name}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center justify-center min-w-[60px]">
            <span className="text-xs text-zinc-500 font-bold uppercase mb-1">{t('memberStats.totalPt' as any)}</span>
            <span className={`text-3xl font-black ${stats.pt >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {stats.pt > 0 ? '+' : ''}{stats.pt.toFixed(1)}
            </span>
          </div>
        </div>

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
        <div className="grid grid-cols-4 gap-2">
          {['🥇', '🥈', '🥉', '4️⃣'].map((emoji, idx) => (
            <div key={idx} className="flex items-center justify-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/30 border border-zinc-100 dark:border-zinc-700/30">
              <span className="text-sm">{emoji}</span>
              <span className="font-bold text-sm text-zinc-700 dark:text-zinc-300">{stats.rankCounts[idx]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Card 2: Trend Chart */}
      {stats.chartRounds.length > 0 && viewingMemberId && (
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
      <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-4">{t('memberStats.matchHistory' as any)}</h2>
        
        {matchHistory.length === 0 ? (
          <div className="text-center text-zinc-400 py-6">{t('memberStats.noData' as any)}</div>
        ) : (
          <div className="space-y-4">
            {matchHistory.map((item) => {
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
                  
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    {players.map(p => {
                      const isMe = p.player_id === item.playerId;
                      return (
                        <div key={p.player_id} className={`flex justify-between p-1.5 rounded ${isMe ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800/50' : 'bg-zinc-50 dark:bg-zinc-800/40'}`}>
                          <span className={`truncate mr-1 ${isMe ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                            {p.player_name}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-zinc-400">{p.raw_score}</span>
                            <span className={`font-bold font-mono w-8 text-right ${p.pt >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
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
        )}
      </div>
      
    </div>
  );
}
