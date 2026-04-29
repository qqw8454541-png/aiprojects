'use client';
import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import { toPng } from 'html-to-image';
import type { Player } from '@/lib/store';
import { getEvaluationsBatch, type PlayerEvalStats } from '@/lib/evaluations';
import { QRCodeSVG } from 'qrcode.react';
import { useTheme } from 'next-themes';



export default function ReportPage() {
  const { t, locale } = useI18n();
  const { theme } = useTheme();
  const { roomName, rounds, players, setPage } = useGameStore();

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

  const [shareFile, setShareFile] = useState<File | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [evaluations, setEvaluations] = useState<Record<string, string>>({});
  const [isEvaluating, setIsEvaluating] = useState(true);
  
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

      const result = await getEvaluationsBatch(playersData, locale);
      
      if (result.error) {
        let errorMsg = t('eval.apiError' as Parameters<typeof t>[0]) || "Error";
        if (result.error === 'QUOTA_EXCEEDED') {
          errorMsg = t('eval.quotaExceeded' as Parameters<typeof t>[0]);
        } else if (result.error === 'NO_API_KEY') {
          errorMsg = t('eval.noApiKey' as Parameters<typeof t>[0]);
        } else if (result.error === 'JSON_FORMAT_ERROR') {
          errorMsg = t('eval.formatError' as Parameters<typeof t>[0]);
        }
        alert(errorMsg);
        return; // Exit early without touching state or cache
      }

      newEvaluations = result.data || {};
      setEvaluations(newEvaluations);
      localStorage.setItem('mahjong-evaluations-cache', JSON.stringify({
        data: newEvaluations,
        roundCount: completedRounds.length
      }));
    } catch (e: any) {
      console.error("fetchEvaluations catch:", e);
      alert(t('eval.apiError' as Parameters<typeof t>[0]) || "Error");
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
          setIsEvaluating(false);
          return;
        }
      } catch (e) {
        console.error("Failed to parse evaluation cache", e);
      }
    }
    fetchEvaluations();
  }, [completedRounds.length]);

  useEffect(() => {
    if (isEvaluating || Object.keys(evaluations).length === 0) return;

    let mounted = true;
    setIsGenerating(true);

    const timer = setTimeout(async () => {
      try {
        const el = document.getElementById('report-card');
        if (!el) return;
        const isDark = theme === 'dark' || document.documentElement.classList.contains('dark');
        const generatedDataUrl = await toPng(el, { 
          cacheBust: true, 
          backgroundColor: isDark ? '#18181b' : '#ffffff',
          pixelRatio: 2,
          style: { transform: 'scale(1)', transformOrigin: 'top left' }
        });
        
        if (!mounted) return;
        
        const filename = `mahjong-report-${new Date().toISOString().slice(0,10)}.png`;
        const blob = dataURItoBlob(generatedDataUrl);
        const file = new File([blob], filename, { type: 'image/png' });
        
        setShareFile(file);
        setDataUrl(generatedDataUrl);
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

  function handleDownload() {
    if (!shareFile || !dataUrl) return;

    const fallbackDownload = () => {
      const link = document.createElement('a');
      link.download = shareFile.name;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    if (navigator.share) {
      if (navigator.canShare && !navigator.canShare({ files: [shareFile] })) {
        fallbackDownload();
        return;
      }
      
      // Extremely crucial for iOS Safari:
      // This call is now 100% synchronous relative to the user's onClick event!
      // No awaits exist between the click and this line.
      navigator.share({
        files: [shareFile]
      }).catch((shareErr: any) => {
        if (shareErr.name === 'AbortError') return; // User cancelled
        console.error('iOS Share Sheet failed', shareErr);
        fallbackDownload();
      });
    } else {
      fallbackDownload();
    }
  }

  return (
    <div className="min-h-dvh flex flex-col p-4 pt-24 page-enter items-center">

      <div id="report-card" className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-3xl rounded-full" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full" />
        
        <h1 className="text-xl font-black text-center mb-2 tracking-wider text-zinc-900 dark:text-zinc-100">{roomName ? roomName : t('room.title' as Parameters<typeof t>[0])}</h1>
        <div className="text-center text-zinc-600 dark:text-zinc-500 text-xs mb-8">
          {new Date().toLocaleDateString()} • {completedRounds.length} Rounds • ⏱ {durationStr}
        </div>

        <div className="space-y-3 relative z-10">
          {sortedPlayers.map(([playerId, pt], idx) => {
            const playerName = playerNamesMap[playerId] ?? '?';
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
            return (
              <div key={playerId} className="flex flex-col bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/30">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 text-center font-bold font-mono text-lg ${idx === 0 ? 'text-amber-500 dark:text-amber-400' : 'text-zinc-400 dark:text-zinc-500'}`}>
                      {medal || (idx + 1)}
                    </div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-200 text-lg">{playerName}</div>
                  </div>
                  <div className={`font-mono text-xl font-bold ${pt >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {pt >= 0 ? '+' : ''}{pt.toFixed(1)}
                  </div>
                </div>
                
                {/* Humorous Comment */}
                <div className="text-[11px] text-zinc-600 dark:text-zinc-400 italic mb-2 mt-[-2px] leading-snug">
                  &quot;{isEvaluating ? t('room.calculating' as Parameters<typeof t>[0]) + '...' : (evaluations[playerId] || '...')}&quot;
                </div>
                
                {/* Round breakdown */}
                <div className="grid grid-cols-4 gap-1.5 mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/50">
                  {completedRounds.map((r) => {
                    const roundResult = r.results?.find(res => res.playerId === playerId);
                    if (!roundResult) {
                      return (
                        <div key={r.id} className="flex flex-col items-center bg-zinc-50 dark:bg-black/20 border border-zinc-200 dark:border-transparent rounded p-1 opacity-70">
                          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">#{r.roundNumber}</span>
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                            {t('room.bye' as Parameters<typeof t>[0])}
                          </span>
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
              </div>
            );
          })}
        </div>
        
        <div className="mt-8 flex items-center justify-center gap-3">
          <div className="bg-white p-1 rounded-lg">
            <QRCodeSVG value="https://aiprojects-sable.vercel.app/" size={48} level="L" includeMargin={false} />
          </div>
          <div className="text-left text-[10px] text-zinc-500 dark:text-zinc-500 font-mono leading-tight">
            <p>Generated by</p>
            <p className="font-bold text-zinc-700 dark:text-zinc-400">Mahjong Scorer</p>
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={() => fetchEvaluations(true)}
          disabled={isEvaluating || evalCooldown > 0}
          className={`w-full py-3 rounded-2xl font-bold transition-all shadow-sm ${
            (isEvaluating || evalCooldown > 0)
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed' 
              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 active:scale-95'
          }`}
        >
          {isEvaluating 
            ? `🤔 ${t('room.calculating' as Parameters<typeof t>[0])}...` 
            : evalCooldown > 0 
              ? `⏳ ${evalCooldown}s` 
              : `✨ ${t('room.regenerate' as Parameters<typeof t>[0])}`
          }
        </button>

        <button
          onClick={handleDownload}
          disabled={isGenerating || isEvaluating}
          className={`w-full py-4 rounded-2xl font-bold transition-all shadow-lg ${
            isGenerating || isEvaluating
              ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed shadow-none' 
              : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:brightness-110 active:scale-95 shadow-amber-900/40'
          }`}
        >
          {isGenerating || isEvaluating ? `⏳ ${t('result.downloadImage' as Parameters<typeof t>[0])}...` : `📸 ${t('result.downloadImage' as Parameters<typeof t>[0])}`}
        </button>
      </div>
    </div>
  );
}
