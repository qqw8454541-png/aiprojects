'use client';

import { useI18n } from '@/lib/i18n';
import type { PlayerResult } from '@/lib/scoring';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface RankChartProps {
  rounds: { id: string; roundNumber: number; results?: PlayerResult[] }[];
  sortedPlayers: [string, number][]; // [playerId, cumulativePT]
  playerNamesMap: Record<string, string>;
  playerId?: string;
}

// Colors correspond to the final rank (1st to 4th)
const PLAYER_COLORS = [
  '#f59e0b', // amber-500
  '#a1a1aa', // zinc-400
  '#c2410c', // orange-700
  '#52525b', // zinc-600
];

export default function RankChart({ rounds, sortedPlayers, playerNamesMap, playerId }: RankChartProps) {
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
    
    return { lines, numRounds: validRounds.length };
  }, [rounds, sortedPlayers, playerId]);

  if (chartData.numRounds === 0) return null;

  // SVG Dimensions and Margins
  const width = 320;
  const height = playerId ? 90 : 140;
  const padding = { top: playerId ? 15 : 20, right: 15, bottom: 20, left: 20 };
  
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  
  // X scale: 0 to numRounds - 1
  const getX = (index: number) => {
    if (chartData.numRounds <= 1) return padding.left + innerWidth / 2;
    return padding.left + (index / (chartData.numRounds - 1)) * innerWidth;
  };
  
  // Y scale: rank 1 to 4 (or 3 for Sanma)
  const maxRank = sortedPlayers.length; // 3 or 4
  const getY = (rank: number) => {
    // rank 1 is at top (padding.top), rank maxRank is at bottom (padding.top + innerHeight)
    if (maxRank <= 1) return padding.top + innerHeight / 2;
    return padding.top + ((rank - 1) / (maxRank - 1)) * innerHeight;
  };

  return (
    <div className={`w-full ${playerId ? 'mt-2 mb-2' : 'bg-zinc-50 dark:bg-zinc-800/60 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/30 overflow-hidden relative mb-4'}`}>
      {!playerId && (
        <div className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-2 tracking-wider">
          {t('report.rankTrend' as any)}
        </div>
      )}
      
      <div className={`relative w-full ${playerId ? 'aspect-[16/4.5]' : 'aspect-[16/7]'}`}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          style={{ vectorEffect: 'non-scaling-stroke' }}
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
                  x2={width - padding.right}
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
          {chartData.numRounds > 0 && Array.from({ length: chartData.numRounds }).map((_, i) => {
            const x = getX(i);
            const roundNumber = chartData.lines[0]?.points[i]?.roundNumber || (i + 1);
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
            
            // Build SVG path with smooth curves, separating solid and dashed segments for byes
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
                // Gap detected (bye), draw dashed curve for this segment
                dashedPath += `M ${prevX} ${prevY} ${curve}`;
                solidPath += `M ${x} ${y} `; // start new solid segment
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
    </div>
  );
}
