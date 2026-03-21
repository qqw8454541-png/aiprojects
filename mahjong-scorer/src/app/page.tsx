'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import type { RuleConfig } from '@/lib/rules';
import type { Wind, PlayerScore, PlayerResult } from '@/lib/scoring';
import {
  abbreviatedToFull,
  calculateLastScore,
  calculatePT,
} from '@/lib/scoring';
import RulePresets from '@/components/RulePresets';
import NumPad from '@/components/NumPad';
import ScoreDisplay from '@/components/ScoreDisplay';
import ResultCard from '@/components/ResultCard';
import { toPng } from 'html-to-image';
import { getEvaluation } from '@/lib/evaluations';

// ──────────────────────── HOME PAGE ──────────────────────────

function HomePage() {
  const { t } = useI18n();
  const setPage = useGameStore((s) => s.setPage);

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh px-6 page-enter">
      {/* Logo area */}
      <div className="text-center mb-12">
        <div className="relative w-32 h-32 mx-auto mb-6">
          <svg viewBox="0 0 120 120" className="w-full h-full animate-[float_4s_ease-in-out_infinite] filter drop-shadow-xl relative z-10" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(10, 85) rotate(-15)">
              <rect x="0" y="0" width="100" height="12" rx="6" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5"/>
              <circle cx="50" cy="6" r="4" fill="#ef4444"/>
              <circle cx="20" cy="6" r="2" fill="#1e293b"/>
              <circle cx="80" cy="6" r="2" fill="#1e293b"/>
              <circle cx="10" cy="6" r="2" fill="#1e293b"/>
              <circle cx="90" cy="6" r="2" fill="#1e293b"/>
            </g>
            <g transform="translate(35, 10) rotate(8)">
              <rect x="0" y="4" width="50" height="70" rx="6" fill="#cbd5e1" />
              <rect x="-4" y="0" width="50" height="70" rx="6" fill="#fcfcfc" stroke="#e2e8f0" strokeWidth="2"/>
              <text x="21" y="48" fontFamily="sans-serif" fontWeight="900" fontSize="38" fill="#ef4444" textAnchor="middle">中</text>
            </g>
          </svg>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-amber-500/20 rounded-full blur-xl z-0"></div>
        </div>
        <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
          {t('app.title')}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2">{t('app.subtitle')}</p>
      </div>

      {/* Action buttons */}
      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={() => setPage('create')}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-lg font-bold
                     hover:from-amber-500 hover:to-orange-500 active:scale-[0.98] transition-all
                     shadow-lg shadow-amber-900/30"
        >
          {t('home.createRoom')}
        </button>

        <p className="pt-8 text-[10px] text-zinc-400 dark:text-zinc-500 text-center leading-relaxed opacity-80">
          {t('home.disclaimer')}
        </p>
      </div>
    </div>
  );
}

// ──────────────────────── CREATE PAGE ────────────────────────

function CreatePage() {
  const { t } = useI18n();
  const { setPage, createRoom } = useGameStore();

  function handleRuleSelect(rules: RuleConfig) {
    createRoom(rules);
  }

  return (
    <div className="min-h-dvh px-4 py-6 pt-24 page-enter">

      <RulePresets onSelect={handleRuleSelect} />
    </div>
  );
}

// ──────────────────────── ROOM PAGE ──────────────────────────

function RoomPage() {
  const { t } = useI18n();
  const {
    roomCode, roomName, rules, players, seats, rounds,
    addPlayer, removePlayer,
    rotateSeatsCW, shuffleSeats, swapSeats,
    startNewRound, viewRound,
    setPage, resetRoom, setRoomName,
  } = useGameStore();
  const [nickname, setNickname] = useState('');
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  const allSeated = seats.every((s) => s.playerId !== null);

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

      {/* Add player - auto seats to next empty wind */}
      {players.length < (rules?.mode === '3-player' ? 3 : 4) && (
        <div className="mb-5">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={`${t('room.enterNickname')} (${(rules?.mode === '3-player' ? ['東','南','西'] : ['東','南','西','北'])[players.length]})`}
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
        </div>
      )}

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
                        <span className="text-base font-medium text-amber-700 dark:text-amber-300 truncate">{player.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removePlayer(player.id);
                          }}
                          className="text-xs text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 px-1 ml-1"
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
            ↔ {swapFrom !== null ? 'タップで交換先を選択' : 'カードをタップで2席を交換'}
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
        <div className="mt-4 pb-8">
          <button
            onClick={() => setPage('report')}
            className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-500 dark:from-blue-600 dark:to-indigo-600 hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-blue-500/20"
          >
            {t('result.generateReport' as Parameters<typeof t>[0])}
          </button>
        </div>
      )}
    </div>
  );
}

// ──────────────────────── SCORE PAGE ─────────────────────────

function ScorePage() {
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
                {swapFrom !== null
                  ? (locale === 'ja' ? '↔ タップで交換先を選択' : (locale === 'zh' ? '↔ 点击选择交换目标' : '↔ Tap to select swap target'))
                  : (locale === 'ja' ? '↔ タップで2席を交換' : (locale === 'zh' ? '↔ 点击互换两人座位' : '↔ Tap to swap seats'))}
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
                  submitLabel={t('common.confirm' as Parameters<typeof t>[0]) || "确认"}
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

// ──────────────────────── RESULT PAGE ────────────────────────

function ResultPage() {
  const { t } = useI18n();
  const { roomName, rounds, setPage, startNewRound, viewingRoundId } = useGameStore();

  const completedRounds = rounds.filter(
    (r): r is typeof r & { results: PlayerResult[] } => 
      r.status === 'completed' && !!r.results
  );
  
  const displayRound = viewingRoundId 
    ? completedRounds.find(r => r.id === viewingRoundId) 
    : completedRounds[completedRounds.length - 1];

  if (!displayRound) return null;

  // Calculate cumulative PT and historical names
  const cumulativePT: Record<string, number> = {};
  const playerNamesMap: Record<string, string> = {};
  for (const round of completedRounds) {
    if (!round.results) continue;
    for (const result of round.results) {
      playerNamesMap[result.playerId] = result.playerName;
      cumulativePT[result.playerId] = (cumulativePT[result.playerId] ?? 0) + result.pt;
    }
  }

  return (
    <div className="min-h-dvh px-4 py-6 pt-24 page-enter">

      {/* Current round result */}
      <ResultCard results={displayRound.results} roundNumber={displayRound.roundNumber} />

      {/* Cumulative PT */}
      {completedRounds.length > 1 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">{t('result.totalPt')}</h3>
          <div className="space-y-2">
            {Object.entries(cumulativePT)
              .sort(([, a], [, b]) => b - a)
              .map(([playerId, totalPt]) => {
                const playerName = playerNamesMap[playerId] ?? '?';
                return (
                  <div
                    key={playerId}
                    className="flex items-center justify-between rounded-xl bg-white/50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 px-4 py-3 shadow-sm"
                  >
                    <span className="text-sm text-zinc-800 dark:text-zinc-300 font-medium">{playerName}</span>
                    <span
                      className={`font-mono font-bold ${
                        totalPt >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {totalPt >= 0 ? '+' : ''}
                      {totalPt < 0 ? '▲' : ''}
                      {Math.abs(Math.round(totalPt * 10) / 10).toFixed(1)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Round history */}
      {completedRounds.length > 1 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">{t('result.roundHistory')}</h3>
          <div className="space-y-2">
            {completedRounds.map((round) => {
              if (!round.results) return null;
              return (
              <div key={round.roundNumber} className="rounded-xl bg-zinc-100 dark:bg-zinc-800/30 border border-zinc-200 dark:border-zinc-700/30 p-3">
                <div className="text-xs text-zinc-600 dark:text-zinc-500 mb-2 font-medium">
                  {t('score.round')} #{round.roundNumber}
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-1 text-center text-xs">
                  {Object.keys(playerNamesMap).map((pId) => {
                    const r = round.results?.find(res => res.playerId === pId);
                    if (!r) {
                      return (
                        <div key={pId} className="opacity-50">
                          <div className="text-zinc-500 truncate font-medium">{playerNamesMap[pId]}</div>
                          <div className="font-mono text-[10px] mt-0.5">{t('room.bye' as Parameters<typeof t>[0]) || "轮空"}</div>
                        </div>
                      );
                    }
                    return (
                      <div key={r.playerId}>
                        <div className="text-zinc-700 dark:text-zinc-500 truncate font-medium">{r.playerName}</div>
                        <div
                          className={`font-mono font-bold ${
                            r.pt >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                          }`}
                        >
                          {r.pt >= 0 ? '+' : ''}{r.pt.toFixed(1)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-6 space-y-3 pb-8">
        <button
          onClick={() => startNewRound()}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-600 text-white text-base font-bold
                     hover:from-amber-500 hover:to-orange-500 active:scale-[0.98] transition-all"
        >
          {t('result.nextRound')}
        </button>
        <button
          onClick={() => setPage('room')}
          className="w-full py-3 rounded-2xl bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-sm font-medium
                     hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all"
        >
          {t('result.backToRoom')}
        </button>
      </div>
    </div>
  );
}

// ──────────────────────── REPORT PAGE ────────────────────────

import { useTheme } from 'next-themes';

function ReportPage() {
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

  useEffect(() => {
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
  }, [theme]);

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
                  &quot;{getEvaluation(pt, idx, completedRounds.map(r => r.results?.find(res => res.playerId === playerId)?.pt || 0), locale)}&quot;
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
                            {t('room.bye' as Parameters<typeof t>[0]) || "轮空"}
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
        
        <div className="mt-8 text-center text-[10px] text-zinc-500 dark:text-zinc-600 font-mono">
          Generated by Mahjong Scorer
        </div>
      </div>

      <button
        onClick={handleDownload}
        disabled={isGenerating}
        className={`mt-8 w-full max-w-sm py-4 rounded-2xl font-bold transition-all shadow-lg ${
          isGenerating 
            ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed shadow-none' 
            : 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:brightness-110 active:scale-95 shadow-amber-900/40'
        }`}
      >
        {isGenerating ? `⏳ ${t('result.downloadImage' as Parameters<typeof t>[0])}...` : `📸 ${t('result.downloadImage' as Parameters<typeof t>[0])}`}
      </button>
    </div>
  );
}

// ──────────────────────── MAIN ROUTER ────────────────────────

export default function Home() {
  const currentPage = useGameStore((s) => s.currentPage);

  switch (currentPage) {
    case 'home':
      return <HomePage />;
    case 'create':
      return <CreatePage />;
    case 'room':
      return <RoomPage />;
    case 'score':
      return <ScorePage />;
    case 'result':
      return <ResultPage />;
    case 'report':
      return <ReportPage />;
    default:
      return <HomePage />;
  }
}
