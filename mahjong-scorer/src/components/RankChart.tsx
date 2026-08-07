'use client';

import { useI18n } from '@/lib/i18n';
import type { PlayerResult } from '@/lib/scoring';
import { motion, AnimatePresence } from 'framer-motion';
import { useMemo, useRef, useState, useEffect } from 'react';

interface RankChartProps {
  rounds: { id: string; roundNumber: number; results?: PlayerResult[] }[];
  sortedPlayers: [string, number][]; // [playerId, cumulativePT]
  playerNamesMap: Record<string, string>;
  playerId?: string;
  exportMode?: boolean;
}

// Colors correspond to the final rank (1st to 4th)
const PLAYER_COLORS = [
  '#f59e0b', // amber-500
  '#a1a1aa', // zinc-400
  '#c2410c', // orange-700
  '#52525b', // zinc-600
];

export default function RankChart({ rounds, sortedPlayers, playerNamesMap, playerId, exportMode = false }: RankChartProps) {
  const { t } = useI18n();

  const chartData = useMemo(() => {
    // Only use rounds that have results
    const validRounds = rounds.filter(r => r.results && r.results.length > 0);
    
    // For each player (by final rank), gather their rank in each round
    const lines = sortedPlayers.map(([playerId], playerIndex) => {
      const color = PLAYER_COLORS[playerIndex] || PLAYER_COLORS[0];
      const points: { x: number; y: number; rank: number; roundNumber: number }[] = [];
      
      validRounds.forEach((round, roundIndex) => {
        const result = round.results?.find(res => res.playerId === playerId);
        if (result) {
          points.push({
            x: roundIndex,
            y: result.rank,
            rank: result.rank,
            roundNumber: round.roundNumber
          });
        }
      });
      
      return { playerId, color, points, finalRank: playerIndex + 1 };
    }).filter(line => !playerId || line.playerId === playerId);
    
    return { lines, numRounds: validRounds.length, validRounds };
  }, [rounds, sortedPlayers, playerId]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!exportMode && chartData.numRounds > 10 && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      setShowHint(true);
      const timer = setTimeout(() => setShowHint(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [exportMode, chartData.numRounds]);

  const handleScroll = () => {
    if (showHint) setShowHint(false);
  };

  if (chartData.numRounds === 0) return null;

  const baseWidth = 320;
  const height = playerId ? 90 : 140;
  const padding = { top: playerId ? 15 : 20, right: 15, bottom: 20, left: 20 };
  
  const MIN_SLOTS = 5;
  const MAX_VISIBLE_SLOTS = 10;
  
  const displaySlots = exportMode
    ? Math.max(MIN_SLOTS, chartData.numRounds)
    : chartData.numRounds <= MIN_SLOTS
      ? MIN_SLOTS
      : Math.min(chartData.numRounds, MAX_VISIBLE_SLOTS);
      
  const totalSlots = exportMode ? displaySlots : Math.max(displaySlots, chartData.numRounds);
  
  const viewportInnerWidth = baseWidth - padding.left - padding.right;
  const segmentWidth = displaySlots > 1 ? viewportInnerWidth / (displaySlots - 1) : 0;
  const svgInnerWidth = totalSlots > 1 ? segmentWidth * (totalSlots - 1) : viewportInnerWidth;
  const svgWidth = svgInnerWidth + padding.left + padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  
  const getX = (index: number) => {
    if (totalSlots <= 1) return padding.left + svgInnerWidth / 2;
    return padding.left + index * segmentWidth;
  };
  
  const maxRank = Math.max(4, ...chartData.validRounds.map(r => r.results?.length || 4));
  const getY = (rank: number) => {
    if (maxRank <= 1) return padding.top + innerHeight / 2;
    return padding.top + ((rank - 1) / (maxRank - 1)) * innerHeight;
  };

  return (
    <div className={`w-full relative ${playerId ? 'mt-2 mb-2' : 'bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/30 overflow-hidden mb-4'}`}>
      {!playerId && (
        <div className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-2 tracking-wider">
          {t('report.rankTrend' as any)}
        </div>
      )}
      
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className={`w-full overflow-x-auto overflow-y-hidden no-scrollbar ${playerId ? 'aspect-[16/4.5]' : 'aspect-[16/7]'}`}
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          .no-scrollbar::-webkit-scrollbar { display: none; }
        `}} />
        <div className="h-full" style={{ width: exportMode ? '100%' : `${(svgWidth / baseWidth) * 100}%` }}>
          <svg
            viewBox={`0 0 ${svgWidth} ${height}`}
            className="w-full h-full overflow-visible block"
            style={{ vectorEffect: 'non-scaling-stroke' }}
            preserveAspectRatio="none"
          >
            {/* Horizontal grid lines for ranks */}
            {Array.from({ length: maxRank }).map((_, i) => {
              const rank = i + 1;
              const y = getY(rank);
              return (
                <g key={`grid-y-${rank}`}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={svgWidth - padding.right}
                    y2={y}
                    stroke="currentColor"
                    className="text-zinc-200 dark:text-zinc-700/50"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding.left - 6}
                    y={y}
                    dominantBaseline="middle"
                    textAnchor="end"
                    className="text-[10px] fill-zinc-400 dark:fill-zinc-500 font-mono"
                  >
                    {rank}
                  </text>
                </g>
              );
            })}
            
            {/* X axis labels (Round numbers) */}
            {totalSlots > 0 && Array.from({ length: totalSlots }).map((_, i) => {
              const x = getX(i);
              const roundNumber = chartData.validRounds[i]?.roundNumber || (i + 1);
              return (
                <text
                  key={`label-x-${i}`}
                  x={x}
                  y={height - 2}
                  dominantBaseline="auto"
                  textAnchor="middle"
                  className="text-[9px] fill-zinc-400 dark:fill-zinc-500 font-mono"
                >
                  #{roundNumber}
                </text>
              );
            })}

            {/* Lines and Points */}
            {chartData.lines.map((line, lineIdx) => {
              if (line.points.length === 0) return null;
              
              let solidPath = '';
              let dashedPath = '';
              
              line.points.forEach((p, i) => {
                const x = getX(p.x);
                const y = getY(p.y);
                if (i === 0) {
                  solidPath += `M ${x} ${y} `;
                  return;
                }
                const prevPoint = line.points[i - 1];
                const prevX = getX(prevPoint.x);
                const prevY = getY(prevPoint.y);
                const cpX = (prevX + x) / 2;
                const curve = `C ${cpX} ${prevY}, ${cpX} ${y}, ${x} ${y} `;
                
                if (p.x - prevPoint.x > 1) {
                  dashedPath += `M ${prevX} ${prevY} ${curve}`;
                  solidPath += `M ${x} ${y} `;
                } else {
                  solidPath += curve;
                }
              });
              
              return (
                <g key={`line-${line.playerId}`}>
                  {dashedPath && (
                    <motion.path
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.6 }}
                      transition={{ duration: 0.8, delay: lineIdx * 0.1, ease: 'easeOut' }}
                      d={dashedPath}
                      fill="none"
                      stroke={line.color}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="4 4"
                    />
                  )}
                  {solidPath && (
                    <motion.path
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.8, delay: lineIdx * 0.1, ease: 'easeOut' }}
                      d={solidPath}
                      fill="none"
                      stroke={line.color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  
                  {line.points.map((p, i) => (
                    <motion.circle
                      key={`point-${line.playerId}-${i}`}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3, delay: 0.8 + i * 0.05 + lineIdx * 0.1 }}
                      cx={getX(p.x)}
                      cy={getY(p.y)}
                      r="4"
                      fill={line.color}
                      stroke="white"
                      strokeWidth="1.5"
                      className="dark:stroke-zinc-800"
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      
      {/* Legend */}
      {!playerId && (
        <div className="flex flex-wrap gap-2 mt-3 justify-center">
          {chartData.lines.map((line) => (
            <div key={`legend-${line.playerId}`} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: line.color }} />
              <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate max-w-[60px]">
                {playerNamesMap[line.playerId] || '?'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Drag Hint */}
      <AnimatePresence>
        {showHint && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 dark:bg-white/20 text-white text-[10px] px-3 py-1 rounded-full pointer-events-none backdrop-blur-sm z-10 whitespace-nowrap"
          >
            {t('report.dragHint' as any)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
