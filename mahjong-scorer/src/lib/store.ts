'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RuleConfig } from './rules';
import type { PlayerResult, Wind } from './scoring';

export interface Player {
  id: string;
  name: string;
}

export interface SeatAssignment {
  wind: Wind;
  playerId: string | null;
}

export interface RoundResult {
  id: string;
  roundNumber: number;
  status: 'in_progress' | 'completed';
  startTime: number;
  endTime?: number;
  results?: PlayerResult[];
  currentInputs?: string[];
}

interface GameState {
  // Room
  roomCode: string | null;
  roomName: string | null;
  rules: RuleConfig | null;
  players: Player[];
  seats: SeatAssignment[];
  rounds: RoundResult[];
  viewingRoundId: string | null;
  currentPage: 'home' | 'create' | 'room' | 'score' | 'result' | 'report';

  // Actions
  createRoom: (rules: RuleConfig) => void;
  setRoomName: (name: string) => void;
  updateRules: (rules: RuleConfig) => void;
  addPlayer: (name: string) => void;
  removePlayer: (id: string) => void;
  assignSeat: (wind: Wind, playerId: string | null) => void;
  rotateSeatsCW: () => void;
  shuffleSeats: () => void;
  swapSeats: (indexA: number, indexB: number) => void;
  startNewRound: () => void;
  updateRoundInputs: (inputs: string[]) => void;
  completeRound: (results: PlayerResult[]) => void;
  viewRound: (id: string | null) => void;
  setPage: (page: GameState['currentPage']) => void;
  resetRoom: () => void;
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 9);
}

const initialSeats: SeatAssignment[] = [
  { wind: 'east', playerId: null },
  { wind: 'south', playerId: null },
  { wind: 'west', playerId: null },
  { wind: 'north', playerId: null },
];

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      roomCode: null,
      roomName: null,
      rules: null,
      players: [],
      seats: [...initialSeats.map((s) => ({ ...s }))],
      rounds: [],
      viewingRoundId: null,
      currentPage: 'home',

      createRoom: (rules) =>
        set({
          roomCode: generateRoomCode(),
          roomName: null,
          rules,
          players: [],
          seats: rules.mode === '3-player' 
            ? initialSeats.slice(0, 3).map((s) => ({ ...s }))
            : initialSeats.map((s) => ({ ...s })),
          rounds: [],
          viewingRoundId: null,
          currentPage: 'room',
        }),

      setRoomName: (name) => set({ roomName: name }),

      updateRules: (rules) => set({ rules }),

      addPlayer: (name) =>
        set((state) => {
          const id = generatePlayerId();
          const newPlayers = [...state.players, { id, name }];
          // Auto-assign to first vacant seat
          const newSeats = state.seats.map((s) => ({ ...s }));
          const emptyIndex = newSeats.findIndex((s) => s.playerId === null);
          if (emptyIndex !== -1) {
            newSeats[emptyIndex].playerId = id;
          }
          return { players: newPlayers, seats: newSeats };
        }),

      removePlayer: (id) =>
        set((state) => ({
          players: state.players.filter((p) => p.id !== id),
          seats: state.seats.map((s) =>
            s.playerId === id ? { ...s, playerId: null } : s
          ),
        })),

      assignSeat: (wind, playerId) =>
        set((state) => ({
          seats: state.seats.map((s) => {
            // Clear this player from other seats first
            if (playerId && s.playerId === playerId && s.wind !== wind) {
              return { ...s, playerId: null };
            }
            if (s.wind === wind) {
              return { ...s, playerId };
            }
            return s;
          }),
        })),

      // 順次回転: East player → North, South → East, West → South, North → West
      rotateSeatsCW: () =>
        set((state) => {
          const playerIds = state.seats.map((s) => s.playerId);
          const len = playerIds.length;
          return {
            seats: state.seats.map((s, i) => ({
              ...s,
              playerId: playerIds[(i + 1) % len],
            })),
          };
        }),

      shuffleSeats: () =>
        set((state) => {
          const playerIds = [...state.seats.map((s) => s.playerId)];
          // Fisher-Yates shuffle
          for (let i = playerIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
          }
          return {
            seats: state.seats.map((s, i) => ({
              ...s,
              playerId: playerIds[i],
            })),
          };
        }),

      swapSeats: (indexA, indexB) =>
        set((state) => {
          const newSeats = state.seats.map((s) => ({ ...s }));
          const tmpId = newSeats[indexA].playerId;
          newSeats[indexA].playerId = newSeats[indexB].playerId;
          newSeats[indexB].playerId = tmpId;
          return { seats: newSeats };
        }),

      startNewRound: () =>
        set((state) => {
          const inProgress = Object.values(state.rounds).find(r => r.status === 'in_progress');
          if (inProgress) return state; // Already in progress
          
          const newRound: RoundResult = {
            id: generatePlayerId(),
            roundNumber: state.rounds.length + 1,
            status: 'in_progress',
            startTime: Date.now(),
            currentInputs: Array(state.seats.length).fill(''),
          };
          return {
            rounds: [...state.rounds, newRound],
            currentPage: 'score',
          };
        }),

      updateRoundInputs: (inputs) =>
        set((state) => {
          const newRounds = state.rounds.map((r) =>
            r.status === 'in_progress' ? { ...r, currentInputs: inputs } : r
          );
          return { rounds: newRounds };
        }),

      completeRound: (results) =>
        set((state) => {
          const newRounds = state.rounds.map((r) =>
            r.status === 'in_progress'
              ? { ...r, status: 'completed' as const, endTime: Date.now(), results }
              : r
          );
          return {
            rounds: newRounds,
            viewingRoundId: state.rounds.find(r => r.status === 'in_progress')?.id || null,
            currentPage: 'result',
          };
        }),

      viewRound: (id) => set({ viewingRoundId: id, currentPage: 'result' }),

      setPage: (page) => set({ currentPage: page }),

      resetRoom: () =>
        set({
          roomCode: null,
          roomName: null,
          rules: null,
          players: [],
          seats: initialSeats.map((s) => ({ ...s })),
          rounds: [],
          viewingRoundId: null,
          currentPage: 'home',
        }),
    }),
    {
      name: 'mahjong-scorer-storage',
    }
  )
);
