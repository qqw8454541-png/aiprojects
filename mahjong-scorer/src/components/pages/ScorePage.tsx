'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import type { Wind, PlayerScore, PlayerResult } from '@/lib/scoring';
import { abbreviatedToFull, calculateLastScore, calculatePT } from '@/lib/scoring';
import RulePresets from '@/components/RulePresets';
import NumPad from '@/components/NumPad';
import ScoreDisplay from '@/components/ScoreDisplay';
import type { Player } from '@/lib/store';

export default function ScorePage() {
  const { t, locale } = useI18n();
  const { roomName, seats, players, rules, rounds, completeRound, updateRoundInputs, setPage, rotateSeatsCW, shuffleSeats, swapSeats } = useGameStore();

  const inProgressRound = rounds.find((r) => r.status === 'in_progress');
  
  // 4 input values as abbreviated strings (e.g. "355", "-12")
  const [inputs, setInputs] = useState<string[]>(inProgressRound?.currentInputs || ['', '', '', '']);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showSeatPanel, setShowSeatPanel] = useState(false);
  const [isEditingRules, setIsEditingRules] = useState(false);
  const [swapFrom, setSwapFrom] = useState<number | null>(null);

  // Sync inputs back to store on change
  useEffect(() => {
    updateRoundInputs(inputs);
  }, [inputs, updateRoundInputs]);

  if (!rules) return null;

  const startPoints = rules.startPoints;
  const limit = rules?.mode === '3-player' ? 3 : 4;

  // Get player names in seat order
  const seatedPlayers = seats.map((s) => {
    const player = players.find((p) => p.id === s.playerId);
    return {
      name: player?.name ?? '?',
      id: s.playerId ?? '',
      wind: s.wind,
    };
  });

  // Parse inputs to numbers (abbreviated)
  function parseInput(val: string): number | null {
    if (!val || val === '-') return null;
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  }

  // Auto-calc last player
  function getDisplayInputs(): string[] {
    const display = [...inputs];
    const limit = rules?.mode === '3-player' ? 3 : 4;
    
    // Auto calc the last slot if all previous inputs are filled
    const activeInputs = inputs.slice(0, limit - 1).map(parseInput);
    if (activeInputs.every((v) => v !== null)) {
      const fulls = activeInputs.map((v) => abbreviatedToFull(v!));
      const lastFull = calculateLastScore(fulls, startPoints);
      const lastAbbr = lastFull / 100;
      display[limit - 1] = lastAbbr.toString();
    }
    return display;
  }

  const displayInputs = getDisplayInputs();

  // Validation
  function getFullScores(): number[] {
    const limit = rules?.mode === '3-player' ? 3 : 4;
    return displayInputs.slice(0, limit).map((v) => {
      const n = parseInput(v);
      return n !== null ? abbreviatedToFull(n) : 0;
    });
  }

  const fullScores = getFullScores();
  const sumValid = fullScores.reduce((a, b) => a + b, 0) === startPoints * limit;
  const allFilled = displayInputs.slice(0, limit).every((v) => v !== '' && v !== '-' && parseInput(v) !== null);
  const isValid = allFilled && sumValid;

  // NumPad handlers
  function handleDigit(digit: string) {
    if (activeIndex === limit - 1) return; // Last is auto-calc
    setInputs((prev) => {
      const next = [...prev];
      const current = next[activeIndex];
      // Limit to 4 digits (plus optional minus)
      const absLen = current.replace('-', '').length;
      if (absLen >= 4) return prev;
      next[activeIndex] = current + digit;
      return next;
    });
  }

  function handleBackspace() {
    if (activeIndex === limit - 1) return;
    setInputs((prev) => {
      const next = [...prev];
      const current = next[activeIndex];
      if (current.length > 0) {
        next[activeIndex] = current.slice(0, -1);
      }
      return next;
    });
  }

  function handleToggleSign() {
    if (activeIndex === limit - 1) return;
    setInputs((prev) => {
      const next = [...prev];
      const current = next[activeIndex];
      if (current.startsWith('-')) {
        next[activeIndex] = current.slice(1);
      } else if (current !== '') {
        next[activeIndex] = '-' + current;
      } else {
        next[activeIndex] = '-';
      }
      return next;
    });
  }

  function handleNext() {
    if (activeIndex < limit - 2) {
      setActiveIndex(activeIndex + 1);
    } else if (activeIndex === limit - 2) {
      setActiveIndex(0);
    }
  }

  function handleCalculate() {
    if (!isValid) return;

    const playerScores: PlayerScore[] = seatedPlayers.map((p, i) => ({
      playerId: p.id,
      playerName: p.name,
      wind: p.wind as Wind,
      rawScore: fullScores[i],
    }));

    if (!rules) return;

    const results: PlayerResult[] = calculatePT(playerScores, rules);
    completeRound(results);
  }

  return (
    <div className="flex flex-col min-h-dvh pt-24 page-enter">
      <div className="flex justify-end px-4 pb-3">
        <button 
          onClick={() => setIsEditingRules(true)}
          className="text-xs font-medium text-zinc-500 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-500 transition-colors flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/50 px-2 py-1 rounded-md"
        >
          ⚙️ {t('score.title')} Setup
        </button>
      </div>
      {/* Score cards */}
      <div className="flex-1 px-4 pb-2">
        <div className={`grid gap-2 ${limit === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {seatedPlayers.slice(0, limit).map((p, i) => (
            <button
              key={p.id}
              onClick={() => i < limit - 1 && setActiveIndex(i)}
              className="text-left"
            >
              <ScoreDisplay
                inputValue={displayInputs[i]}
                playerName={p.name}
                playerId={p.id}
                wind={p.wind as Wind}
                isActive={activeIndex === i}
                isAutoCalc={i === limit - 1}
              />
            </button>
          ))}
        </div>

        {/* Validation indicator */}
        <div className="mt-3 text-center">
          {allFilled ? (
            <span
              className={`text-sm font-bold ${
                sumValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
              }`}
            >
              {sumValid
                ? t('score.validation.ok')
                : `${t('score.validation.mismatch')} (${fullScores.reduce((a, b) => a + b, 0).toLocaleString()} ≠ ${(startPoints * limit).toLocaleString()})`}
            </span>
          ) : (
            <span className="text-xs text-zinc-500 dark:text-zinc-600 font-medium">{t('score.inputHint')}</span>
          )}
        </div>
      </div>

      {/* Seat management panel */}
      <div className="px-4 pb-2">
        <button
          onClick={() => setShowSeatPanel(!showSeatPanel)}
          className="w-full text-xs text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 py-1 transition-colors flex items-center justify-center gap-1"
        >
          <span>{showSeatPanel ? '▼' : '▶'}</span>
          <span>{t('score.seatManage')}</span>
        </button>

        {showSeatPanel && (
          <div className="mt-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-800/50 p-3 space-y-3 shadow-sm">
            {/* Quick actions */}
            <div className="flex gap-2">
              <button
                onClick={() => { rotateSeatsCW(); setInputs(['', '', '', '']); }}
                className="flex-1 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-600/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-600/30 active:scale-[0.97] transition-all"
              >
                🔄 {t('score.rotateCW')}
              </button>
              <button
                onClick={() => { shuffleSeats(); setInputs(['', '', '', '']); }}
                className="flex-1 py-2 rounded-lg bg-purple-50 dark:bg-purple-600/20 border border-purple-200 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-sm font-medium hover:bg-purple-100 dark:hover:bg-purple-600/30 active:scale-[0.97] transition-all"
              >
                🎲 {t('score.shuffle')}
              </button>
            </div>

            {/* Tap-to-swap seats */}
            <div>
              <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mb-2 text-center">
                {swapFrom !== null ? t('room.swapActive' as Parameters<typeof t>[0]) : t('room.swapIdle' as Parameters<typeof t>[0])}
              </div>
              <div className={`grid gap-1.5 ${limit === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                {seatedPlayers.slice(0, limit).map((seat, idx) => {
                  const player = players.find(p => p.id === seat.id);
                  const isSelected = swapFrom === idx;
                  const windLabels: Record<string, string> = {
                    east: t('room.east'), south: t('room.south'),
                    west: t('room.west'), north: t('room.north'),
                  };
                  return (
                    <button
                      key={seat.wind}
                      onClick={() => {
                        if (swapFrom === null) {
                          setSwapFrom(idx);
                        } else if (swapFrom === idx) {
                          setSwapFrom(null);
                        } else {
                          swapSeats(swapFrom, idx);
                          setSwapFrom(null);
                          setInputs(['', '', '', '']);
                        }
                      }}
                      className={`py-2 rounded-lg text-center text-xs transition-all ${
                        isSelected
                          ? 'bg-amber-100 dark:bg-amber-500/30 border-2 border-amber-400 dark:border-amber-400 ring-1 ring-amber-400/50 dark:ring-amber-400/50'
                          : 'bg-zinc-100 dark:bg-zinc-700/50 border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-600/50'
                      }`}
                    >
                      <div className="font-bold text-zinc-500 dark:text-zinc-400">{windLabels[seat.wind]}</div>
                      <div className="text-zinc-800 dark:text-zinc-300 truncate px-1 mt-0.5">{player?.name ?? '-'}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="px-2 pb-4 safe-area-pb">
        <NumPad
          onInput={handleDigit}
          onBackspace={handleBackspace}
          onToggleSign={handleToggleSign}
          onNext={handleNext}
          showConfirm={true}
          confirmDisabled={!isValid}
          onConfirm={handleCalculate}
          confirmLabel={t('score.calculate')}
        />
      </div>

      {/* Rule Edit Modal */}
      <AnimatePresence>
        {isEditingRules && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm max-h-[90dvh] overflow-y-auto shadow-xl"
            >
              <div className="p-4 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur z-10">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{t('create.title')}</h3>
                <button
                  onClick={() => setIsEditingRules(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  ✕
                </button>
              </div>
              <div className="p-4">
                <RulePresets
                  onSelect={(newRules) => {
                    useGameStore.getState().updateRules(newRules);
                    setIsEditingRules(false);
                  }}
                  defaultRules={rules}
                  submitLabel={t('common.confirm' as Parameters<typeof t>[0])}
                  disabledMode={true}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
