'use client';
import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { triggerGateAction } from '@/components/VipGate';
import { toPng } from 'html-to-image';
import type { Player } from '@/lib/store';
import { getEvaluationsBatch, type PlayerEvalStats } from '@/lib/evaluations';
import type { ScoringContext } from '@/lib/llm.config';
import { QRCodeSVG } from 'qrcode.react';
import { useTheme } from 'next-themes';
import { Loader2 } from 'lucide-react';
import Avatar from '@/components/Avatar';
import AiErrorModal from '@/components/AiErrorModal';
import RankChart from '@/components/RankChart';
import { motion, AnimatePresence } from 'framer-motion';

import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

const getRankSuffix = (rank: number, locale: string) => {
  if (locale === 'ja') return '着';
  if (locale === 'zh') return '位';
  return rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th';
};

export default function ReportPage() {
  const { t, locale } = useI18n();
  const { theme } = useTheme();
  const { roomName, rounds, players, rules, setPage } = useGameStore();

  const completedRounds = rounds.filter(r => r.status === 'completed' && r.results);

  // Calculate cumulative PT and safe names
  const cumulativePT: Record<string, number> = {};
  const playerNamesMap: Record<string, string> = {};
  for (const round of completedRounds) {
    if (!round.results) continue;
    for (const result of round.results) {
      playerNamesMap[result.playerId] = result.playerName;
      cumulativePT[result.playerId] = (cumulativePT[result.playerId] ?? 0) + result.pt;
    }
  }

  const sortedPlayers = Object.entries(cumulativePT).sort(([, a], [, b]) => b - a);

  // Detailed stats
  const detailedStats: Record<string, { totalRank: number; rounds: number; finalRawScore: number }> = {};
  for (const round of completedRounds) {
    if (!round.results) continue;
    for (const result of round.results) {
      if (!detailedStats[result.playerId]) {
        detailedStats[result.playerId] = { totalRank: 0, rounds: 0, finalRawScore: 0 };
      }
      detailedStats[result.playerId].totalRank += result.rank;
      detailedStats[result.playerId].rounds += 1;
      detailedStats[result.playerId].finalRawScore += result.rawScore;
    }
  }

  // Match duration
  let hours = 0;
  let minutes = 0;
  if (completedRounds.length > 0) {
    const firstStartTime = completedRounds[0]?.startTime;
    const lastEndTime = completedRounds[completedRounds.length - 1]?.endTime;
    if (firstStartTime && lastEndTime) {
      const diffMs = Math.max(0, lastEndTime - firstStartTime);
      hours = Math.floor(diffMs / (1000 * 60 * 60));
      minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    }
  }
  const durationStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  function dataURItoBlob(dataURI: string) {
    const [header, base64] = dataURI.split(',');
    const mimeStr = header.split(':')[1].split(';')[0];
    const byteStr = atob(base64);
    const ab = new ArrayBuffer(byteStr.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteStr.length; i++) {
        ia[i] = byteStr.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeStr });
  }

  const [shareFiles, setShareFiles] = useState<{ simple: File | null, detailed: File | null }>({ simple: null, detailed: null });
  const [dataUrls, setDataUrls] = useState<{ simple: string | null, detailed: string | null }>({ simple: null, detailed: null });
  const [isGenerating, setIsGenerating] = useState(true);
  const [evaluations, setEvaluations] = useState<Record<string, string>>({});
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiError, setAiError] = useState<{ type: string; details?: string } | null>(null);
  
  const [viewMode, setViewMode] = useState<'simple' | 'detailed'>('detailed');
  
  const evalLockRef = useRef(false);
  const [evalCooldown, setEvalCooldown] = useState(0);

  useEffect(() => {
    if (evalCooldown > 0) {
      const timer = setTimeout(() => setEvalCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [evalCooldown]);

  useEffect(() => {
    const lastFetch = Number(localStorage.getItem('mahjong-evaluations-time') || '0');
    const diff = Math.floor((Date.now() - lastFetch) / 1000);
    if (diff < 10) {
      setEvalCooldown(10 - diff);
    }
  }, []);

  const fetchEvaluations = async (isManualRefresh = false) => {
    if (evalLockRef.current) return;
    if (isManualRefresh && evalCooldown > 0) return;

    // ── VipGate: AI 功能需要登录 + 额度 ──────────────────
    if (!triggerGateAction('ai')) {
      return; // 被拦截（弹出了登录或购买弹窗）
    }

    if (isManualRefresh) {
      localStorage.setItem('mahjong-evaluations-time', Date.now().toString());
      setEvalCooldown(10);
    }

    evalLockRef.current = true;
    setIsEvaluating(true);
    let newEvaluations: Record<string, string> = {};
    try {
      const playersData: PlayerEvalStats[] = sortedPlayers.map(([playerId, pt], idx) => ({
        playerId: playerId,
        playerName: playerNamesMap[playerId] ?? 'Unknown',
        pt: pt,
        rank: idx + 1,
        history: completedRounds.map(r => r.results?.find(res => res.playerId === playerId)?.pt || 0)
      }));

      const scoringCtx: ScoringContext | undefined = rules ? { ruleName: rules.name, uma: rules.uma, roundCount: completedRounds.length } : undefined;
      const result = await getEvaluationsBatch(playersData, locale, scoringCtx);
      
      if (result.error) {
        setAiError({ type: result.error, details: result.details });
        return; // Exit early without touching state or cache
      }

      newEvaluations = result.data || {};
      setEvaluations(newEvaluations);
      localStorage.setItem('mahjong-evaluations-cache', JSON.stringify({
        data: newEvaluations,
        roundCount: completedRounds.length
      }));
    } catch (e: any) {
      console.warn("fetchEvaluations catch:", e);
      setAiError({ type: 'UNKNOWN_ERROR', details: e?.message || String(e) });
    } finally {
      setIsEvaluating(false);
      evalLockRef.current = false;
    }
  };

  useEffect(() => {
    const cached = localStorage.getItem('mahjong-evaluations-cache');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Only use cache if the round count matches (meaning no new rounds were played)
        if (parsed.roundCount === completedRounds.length && parsed.data) {
          setEvaluations(parsed.data);
          return;
        }
      } catch (e) {
        console.error("Failed to parse evaluation cache", e);
      }
    }
    // No longer auto-fetching evaluations on load to save AI API costs
  }, [completedRounds.length]);

  useEffect(() => {
    // We only wait for evaluation to finish if it's actively evaluating. 
    // If it's not evaluating (even if evaluations are empty), we generate the image!
    if (isEvaluating) return;

    let mounted = true;
    setIsGenerating(true);

    const timer = setTimeout(async () => {
      try {
        const elSimple = document.getElementById('report-card-export-simple');
        const elDetailed = document.getElementById('report-card-export-detailed');
        if (!elSimple || !elDetailed) return;
        
        const isDark = theme === 'dark' || document.documentElement.classList.contains('dark');
        const opts = { 
          cacheBust: true, 
          backgroundColor: isDark ? '#18181b' : '#ffffff',
          pixelRatio: 2,
          style: { transform: 'scale(1)', transformOrigin: 'top left', margin: '0' }
        };
        
        const simpleUrl = await toPng(elSimple, { ...opts, width: elSimple.offsetWidth, height: elSimple.offsetHeight });
        const detailedUrl = await toPng(elDetailed, { ...opts, width: elDetailed.offsetWidth, height: elDetailed.offsetHeight });
        
        if (!mounted) return;
        
        const dateStr = new Date().toISOString().slice(0,10);
        
        const blobSimple = dataURItoBlob(simpleUrl);
        const fileSimple = new File([blobSimple], `mahjong-report-simple-${dateStr}.png`, { type: 'image/png' });

        const blobDetailed = dataURItoBlob(detailedUrl);
        const fileDetailed = new File([blobDetailed], `mahjong-report-detailed-${dateStr}.png`, { type: 'image/png' });
        
        setShareFiles({ simple: fileSimple, detailed: fileDetailed });
        setDataUrls({ simple: simpleUrl, detailed: detailedUrl });
      } catch (err) {
        console.error('Background generation failed', err);
      } finally {
        if (mounted) setIsGenerating(false);
      }
    }, 600); // Wait 600ms for animations and fonts to settle

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [theme, isEvaluating, evaluations]);

  async function handleDownload() {
    const file = shareFiles[viewMode];
    const url = dataUrls[viewMode];
    if (!file || !url) return;

    const fallbackDownload = () => {
      const link = document.createElement('a');
      link.download = file.name;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (Capacitor.isNativePlatform()) {
      try {
        const base64Data = url.split(',')[1];
        const filename = `mahjong-report-${Date.now()}.png`;
        
        const savedFile = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache
        });

        await Share.share({
          title: t('result.downloadImage' as Parameters<typeof t>[0]),
          text: roomName || t('room.title' as Parameters<typeof t>[0]),
          url: savedFile.uri,
          dialogTitle: t('result.downloadImage' as Parameters<typeof t>[0]),
        });
      } catch (err) {
        console.error('Capacitor share failed', err);
        fallbackDownload();
      }
      return;
    }

    if (navigator.share) {
      if (navigator.canShare && !navigator.canShare({ files: [file] })) {
        fallbackDownload();
        return;
      }
      
      // Extremely crucial for iOS Safari:
      // This call is now 100% synchronous relative to the user's onClick event!
      // No awaits exist between the click and this line.
      navigator.share({
        files: [file]
      }).catch((shareErr: any) => {
        if (shareErr.name === 'AbortError') return; // User cancelled
        console.error('iOS Share Sheet failed', shareErr);
        fallbackDownload();
      });
    } else {
      fallbackDownload();
    }
  }

  const renderCardContent = (mode: 'simple' | 'detailed', domId: string, isExport = false) => (
    <div id={domId} className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
        
        <h1 className="text-xl font-black text-center mb-2 tracking-wider text-zinc-900 dark:text-zinc-100">{roomName ? roomName : t('room.title' as Parameters<typeof t>[0])}</h1>
        <div className="text-center text-zinc-600 dark:text-zinc-500 text-xs mb-8">
          <div>{new Date().toLocaleDateString()} • {completedRounds.length} Rounds • ⏱ {durationStr}</div>
          {rules && <div className="mt-1 font-medium text-zinc-500 dark:text-zinc-400">{rules.name}</div>}
        </div>

        <div className="space-y-3 relative z-10">
          {sortedPlayers.map(([playerId, pt], idx) => {
            const playerName = playerNamesMap[playerId] ?? '?';
            const playerObj = players.find(p => p.id === playerId);
            const avatarSeed = playerObj?.avatarSeed ?? playerId;
            // Rank badge colors for cross-platform support (medal emojis may not render on Android)
            const rankBadgeColor = idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-zinc-400 text-white' : idx === 2 ? 'bg-orange-700 text-white' : 'bg-zinc-600 text-white';
            return (
              <div key={playerId} className="flex flex-col bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/30">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 flex items-center justify-center rounded-lg text-sm font-black ${rankBadgeColor}`}>
                      {idx + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <Avatar seed={avatarSeed} size={28} />
                      <div className="font-medium text-zinc-900 dark:text-zinc-200 text-lg">{playerName}</div>
                    </div>
                  </div>
                  <div className={`font-mono text-xl font-bold ${pt >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {pt >= 0 ? '+' : ''}{pt.toFixed(1)}
                  </div>
                </div>
                
              {/* Humorous Comment */}
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400 italic mb-2 mt-[-2px] leading-snug">
                {isEvaluating ? (
                  <span className="flex items-center gap-1 opacity-80">
                    <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />
                    {t('room.calculating' as Parameters<typeof t>[0])}...
                  </span>
                ) : (
                  <>&quot;{evaluations[playerId] || '...'}&quot;</>
                )}
              </div>

              {mode === 'detailed' && (
                <RankChart 
                  rounds={completedRounds} 
                  sortedPlayers={sortedPlayers} 
                  playerNamesMap={playerNamesMap} 
                  playerId={playerId}
                  exportMode={isExport}
                />
              )}
              
              {/* Round breakdown */}
              <div className={`grid gap-1.5 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/50 ${mode === 'detailed' ? 'grid-cols-2' : 'grid-cols-4'}`}>
                {completedRounds.map((r) => {
                  const roundResult = r.results?.find(res => res.playerId === playerId);
                  if (!roundResult) {
                    return (
                      <div key={r.id} className={`flex ${mode === 'detailed' ? 'flex-row items-center justify-between px-2 py-1' : 'flex-col items-center'} bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-transparent rounded p-1 opacity-70`}>
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">#{r.roundNumber}</span>
                          <span className={`text-[10px] text-zinc-500 dark:text-zinc-400 font-medium ${viewMode === 'detailed' ? '' : 'mt-0.5'}`}>
                            {t('room.bye' as Parameters<typeof t>[0])}
                          </span>
                        </div>
                      );
                    }
                    
                    if (mode === 'detailed') {
                      const rankColor = roundResult.rank === 1 ? 'text-amber-500' : roundResult.rank === 2 ? 'text-zinc-500' : roundResult.rank === 3 ? 'text-orange-600' : 'text-zinc-600 dark:text-zinc-400';
                      return (
                        <div key={r.id} className="flex items-center justify-center gap-3 bg-zinc-100 dark:bg-black/20 rounded py-1 px-1">
                          <div className="flex items-baseline gap-1.5 w-[36px] justify-end">
                            <span className="text-[10px] text-zinc-400 font-mono leading-none">#{r.roundNumber}</span>
                            <span className={`text-[12px] font-black leading-none ${rankColor}`}>
                              {roundResult.rank}
                              <span className="text-[9px] font-bold opacity-85 ml-[0.5px] leading-none">{getRankSuffix(roundResult.rank, locale)}</span>
                            </span>
                          </div>
                          <div className="flex items-baseline gap-1 text-left whitespace-nowrap flex-1">
                            <span className={`text-[10px] font-mono font-bold leading-none ${roundResult.pt >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-500'}`}>
                              {roundResult.pt >= 0 ? '+' : ''}{roundResult.pt.toFixed(1)}
                            </span>
                            <span className="text-[9px] text-zinc-500 dark:text-zinc-500 font-mono leading-none">
                              ({roundResult.rawScore.toLocaleString()})
                            </span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={r.id} className="flex flex-col items-center bg-zinc-100 dark:bg-black/20 rounded p-1">
                        <span className="text-[9px] text-zinc-500 font-mono">#{r.roundNumber}</span>
                        <span className={`text-[10px] font-mono font-bold ${roundResult.pt >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-500'}`}>
                          {roundResult.pt >= 0 ? '+' : ''}{roundResult.pt.toFixed(1)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                
              {mode === 'detailed' && detailedStats[playerId] && detailedStats[playerId].rounds > 0 && (() => {
                const pStats = detailedStats[playerId];
                const startPts = rules?.startPoints ?? 25000;
                const netScore = pStats.finalRawScore - (pStats.rounds * startPts);
                const netStr = netScore > 0 ? `+${netScore.toLocaleString()}` : netScore.toLocaleString();
                return (
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/50 text-[10px] text-zinc-500 dark:text-zinc-400">
                    <div>
                      {t('report.avgRank' as Parameters<typeof t>[0])}: <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300">{(pStats.totalRank / pStats.rounds).toFixed(2)}</span>
                    </div>
                    <div>
                      {t('report.finalScore' as Parameters<typeof t>[0])}: <span className={`font-mono font-bold ${netScore > 0 ? 'text-emerald-600 dark:text-emerald-500' : netScore < 0 ? 'text-red-500' : 'text-zinc-700 dark:text-zinc-300'}`}>{netStr}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
      
      <div className="mt-8 flex items-center justify-center gap-3">
        <div className="bg-white p-1 rounded-lg">
          <QRCodeSVG value="https://mahjong-scorer.eastree.co.jp/" size={48} level="L" includeMargin={false} />
        </div>
        <div className="text-left text-[10px] text-zinc-500 dark:text-zinc-500 font-mono leading-tight">
          <p>Generated by</p>
          <p className="font-bold text-zinc-700 dark:text-zinc-400">{t('app.title' as Parameters<typeof t>[0])}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh flex flex-col p-4 pt-safe-24 page-enter items-center">
      {/* Toggle View Mode */}
      <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-full mb-6 max-w-sm w-full mx-auto shadow-inner">
        <button
          onClick={() => setViewMode('detailed')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full text-sm font-bold transition-all duration-300 ${
            viewMode === 'detailed'
              ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-800 dark:text-zinc-200'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          📊 {t('report.detailedMode' as Parameters<typeof t>[0])}
        </button>
        <button
          onClick={() => setViewMode('simple')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-full text-sm font-bold transition-all duration-300 ${
            viewMode === 'simple'
              ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-800 dark:text-zinc-200'
              : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
          }`}
        >
          📋 {t('report.simpleMode' as Parameters<typeof t>[0])}
        </button>
      </div>

      {renderCardContent(viewMode, 'report-card')}

      <div className="absolute top-[-9999px] left-[-9999px] opacity-0 pointer-events-none">
        {renderCardContent('simple', 'report-card-export-simple', true)}
        {renderCardContent('detailed', 'report-card-export-detailed', true)}
      </div>

      <div className="mt-8 flex flex-col gap-3 w-full max-w-sm safe-area-pb">
        <button
          onClick={() => fetchEvaluations(true)}
          disabled={isEvaluating || evalCooldown > 0}
          className={`w-full py-3 rounded-2xl font-bold transition-all shadow-sm ${
            (isEvaluating || evalCooldown > 0)
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed' 
              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95'
          }`}
        >
          {isEvaluating ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin opacity-80" />
              {t('room.calculating' as Parameters<typeof t>[0])}...
            </span>
          ) : evalCooldown > 0 ? (
            `⏳ ${evalCooldown}s` 
          ) : (
            <span className="flex items-center justify-center gap-2">
              ✨ {t('room.regenerate' as Parameters<typeof t>[0])}
            </span>
          )}
        </button>

        <button
          onClick={handleDownload}
          disabled={isGenerating || isEvaluating}
          className={`w-full py-4 rounded-2xl font-bold transition-all shadow-lg ${
            isGenerating || isEvaluating
              ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed shadow-none' 
              : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:brightness-110 active:scale-95 shadow-emerald-900/40'
          }`}
        >
          {isGenerating || isEvaluating ? `⏳ ${t('result.downloadImage' as Parameters<typeof t>[0])}...` : `📸 ${t('result.downloadImage' as Parameters<typeof t>[0])}`}
        </button>
      </div>

      <AiErrorModal
        isOpen={!!aiError}
        errorType={aiError?.type ?? null}
        details={aiError?.details}
        onClose={() => setAiError(null)}
      />
    </div>
  );
}
