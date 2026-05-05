'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RuleConfig } from './rules';
import type { PlayerResult, Wind } from './scoring';
import { dbRooms, dbMembers, dbRoomMembers, dbSessions } from './db';
import { safeRandomUUID } from './utils';

// ────────────────────────── Types ──────────────────────────────

export interface Player {
  id: string;
  name: string;
  avatarSeed: string;
  savedMemberId?: string;
}

export interface RecentRoom {
  code: string;
  name?: string;
  lastActive: number;
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

// Pages
export type AppPage =
  | 'landing'
  | 'venue-coming-soon'
  | 'personal-menu'
  | 'create'
  | 'room'
  | 'score'
  | 'result'
  | 'report'
  | 'saved-rooms'
  | 'manage-rooms'
  | 'room-history';

// ────────────────────────── State Interface ─────────────────────

interface GameState {
  // Device identity (anonymous)
  deviceId: string;

  // App-level
  currentPage: AppPage;

  // Room session
  roomCode: string | null;
  roomName: string | null;
  rules: RuleConfig | null;
  players: Player[];
  seats: SeatAssignment[];
  rounds: RoundResult[];
  viewingRoundId: string | null;
  recentRooms: RecentRoom[];

  // Saved room currently being managed/viewed in history
  viewingHistoryRoomId: string | null;

  // If session was started from a saved room, track it for archiving
  sessionSavedRoomId: string | null;

  // Track current active session ID in db to prevent duplicate history records
  currentSessionDbId: string | null;

  // ── Actions ──────────────────────────────────────────────────

  // App navigation
  setPage: (page: AppPage) => void;

  // Room session
  joinRoom: (code: string) => void;
  createRoom: (rules: RuleConfig) => void;
  setRoomName: (name: string) => void;
  updateRules: (rules: RuleConfig) => void;

  // Players & seats
  addPlayer: (name: string) => void;
  addSavedPlayer: (savedMemberId: string, name: string, avatarSeed: string) => void;
  updatePlayer: (id: string, name: string, avatarSeed: string) => void;
  removePlayer: (id: string) => void;
  assignSeat: (wind: Wind, playerId: string | null) => void;
  rotateSeatsCW: () => void;
  shuffleSeats: () => void;
  swapSeats: (indexA: number, indexB: number) => void;

  // Rounds
  startNewRound: () => void;
  updateRoundInputs: (inputs: string[]) => void;
  completeRound: (results: PlayerResult[]) => void;
  viewRound: (id: string | null) => void;
  resetScoresKeepPlayers: () => void;
  resetRoom: () => void;

  // Supabase: save current room as template
  saveCurrentRoom: (overrideName?: string) => Promise<void>;

  // Supabase: load a saved room template and initialize session
  loadSavedRoom: (roomId: string) => Promise<void>;

  // Supabase: archive completed session
  archiveSession: () => Promise<void>;

  // Manage history page
  setViewingHistoryRoomId: (id: string | null) => void;
}

// ────────────────────────── Helpers ────────────────────────────

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'ssr';
  const key = 'mahjong-device-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = safeRandomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

const initialSeats: SeatAssignment[] = [
  { wind: 'east', playerId: null },
  { wind: 'south', playerId: null },
  { wind: 'west', playerId: null },
  { wind: 'north', playerId: null },
];

// ────────────────────────── Store ──────────────────────────────

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      deviceId: '',
      currentPage: 'landing',
      roomCode: null,
      roomName: null,
      rules: null,
      players: [],
      seats: [...initialSeats.map((s) => ({ ...s }))],
      rounds: [],
      viewingRoundId: null,
      recentRooms: [],
      viewingHistoryRoomId: null,
      sessionSavedRoomId: null,
      currentSessionDbId: null,

      // ── Navigation ──────────────────────────────────────────

      setPage: (page) => set({ currentPage: page }),

      // ── Room session ────────────────────────────────────────

      joinRoom: (code) =>
        set((state) => {
          const now = Date.now();
          const updatedRecent = state.recentRooms.filter((r) => r.code !== code);
          updatedRecent.unshift({ code, lastActive: now });
          return {
            roomCode: code,
            roomName: null,
            rules: null,
            players: [],
            seats: initialSeats.map((s) => ({ ...s })),
            rounds: [],
            viewingRoundId: null,
            currentPage: 'landing',
            recentRooms: updatedRecent.slice(0, 10),
            sessionSavedRoomId: null,
            currentSessionDbId: null,
          };
        }),

      createRoom: (rules) =>
        set((state) => {
          const code = generateRoomCode();
          const now = Date.now();
          const updatedRecent = state.recentRooms.filter((r) => r.code !== code);
          updatedRecent.unshift({ code, lastActive: now });
          return {
            roomCode: code,
            roomName: null,
            rules,
            players: [],
            seats:
              rules.mode === '3-player'
                ? initialSeats.slice(0, 3).map((s) => ({ ...s }))
                : initialSeats.map((s) => ({ ...s })),
            rounds: [],
            viewingRoundId: null,
            currentPage: 'room',
            recentRooms: updatedRecent.slice(0, 10),
            sessionSavedRoomId: null,
            currentSessionDbId: null,
          };
        }),

      setRoomName: (name) =>
        set((state) => ({
          roomName: name,
          recentRooms: state.roomCode
            ? state.recentRooms.map((r) =>
                r.code === state.roomCode ? { ...r, name } : r
              )
            : state.recentRooms,
        })),

      updateRules: (rules) => set({ rules }),

      // ── Players & seats ─────────────────────────────────────

      addPlayer: (name) =>
        set((state) => {
          const id = generateId();
          const avatarSeed = Math.random().toString(36).substring(2, 10);
          const newPlayers = [...state.players, { id, name, avatarSeed }];
          const newSeats = state.seats.map((s) => ({ ...s }));
          const emptyIndex = newSeats.findIndex((s) => s.playerId === null);
          if (emptyIndex !== -1) {
            newSeats[emptyIndex].playerId = id;
          }
          return { players: newPlayers, seats: newSeats };
        }),

      addSavedPlayer: (savedMemberId, name, avatarSeed) =>
        set((state) => {
          const id = generateId(); // temporary session ID
          const newPlayers = [...state.players, { id, name, avatarSeed, savedMemberId }];
          const newSeats = state.seats.map((s) => ({ ...s }));
          const emptyIndex = newSeats.findIndex((s) => s.playerId === null);
          if (emptyIndex !== -1) {
            newSeats[emptyIndex].playerId = id;
          }
          return { players: newPlayers, seats: newSeats };
        }),

      updatePlayer: (id, name, avatarSeed) =>
        set((state) => ({
          players: state.players.map((p) =>
            p.id === id ? { ...p, name, avatarSeed } : p
          ),
        })),

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
            if (playerId && s.playerId === playerId && s.wind !== wind) {
              return { ...s, playerId: null };
            }
            if (s.wind === wind) {
              return { ...s, playerId };
            }
            return s;
          }),
        })),

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

      // ── Rounds ──────────────────────────────────────────────

      startNewRound: () =>
        set((state) => {
          const inProgress = state.rounds.find((r) => r.status === 'in_progress');
          if (inProgress) return state;
          const newRound: RoundResult = {
            id: generateId(),
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
        set((state) => ({
          rounds: state.rounds.map((r) =>
            r.status === 'in_progress' ? { ...r, currentInputs: inputs } : r
          ),
        })),

      completeRound: (results) => {
        const inProgressId = get().rounds.find((r) => r.status === 'in_progress')?.id ?? null;
        set((state) => {
          const newRounds = state.rounds.map((r) =>
            r.status === 'in_progress'
              ? { ...r, status: 'completed' as const, endTime: Date.now(), results }
              : r
          );
          return {
            rounds: newRounds,
            viewingRoundId: inProgressId,
            currentPage: 'result',
          };
        });

        // Auto-archive to Supabase
        get().archiveSession().catch((e) => console.error('Failed to auto-archive:', e));
      },

      viewRound: (id) => set({ viewingRoundId: id, currentPage: 'result' }),

      resetScoresKeepPlayers: () =>
        set({
          rounds: [],
          viewingRoundId: null,
          currentPage: 'room',
          sessionSavedRoomId: null,
          currentSessionDbId: null,
        }),

      resetRoom: () =>
        set({
          roomCode: null,
          roomName: null,
          rules: null,
          players: [],
          seats: initialSeats.map((s) => ({ ...s })),
          rounds: [],
          viewingRoundId: null,
          currentPage: 'landing',
          sessionSavedRoomId: null,
          currentSessionDbId: null,
        }),

      // ── Supabase actions ─────────────────────────────────────

      saveCurrentRoom: async (overrideName?: string) => {
        const state = get();
        const deviceId = state.deviceId || getOrCreateDeviceId();
        const roomName = (overrideName || state.roomName)?.trim();
        if (!roomName || !state.rules) {
          throw new Error('room_name_required');
        }
        const limit = state.rules.mode === '3-player' ? 3 : 4;
        // Save ALL players in the room, including the bench
        const playersToSave = [...state.players];

        // Check for duplicate room with exact same members
        const existingRooms = await dbRooms.list(deviceId);
        const currentNames = [...playersToSave.map(p => p.name)].sort();
        for (const room of existingRooms) {
          if (!room.members) continue;
          const activeMembers = room.members.filter(m => m.avatar_seed !== '__DELETED__');
          const roomNames = [...activeMembers.map(m => m.name)].sort();
          if (currentNames.length > 0 && currentNames.length === roomNames.length && currentNames.every((name, i) => name === roomNames[i])) {
            throw new Error('duplicate_room_members');
          }
        }

        // Upsert members
        const memberIds: string[] = [];
        const newPlayers = [...state.players];
        
        for (const player of playersToSave) {
          const member = await dbMembers.upsert({
            id: player.savedMemberId || safeRandomUUID(), // use existing or generate new proper UUID
            device_id: deviceId,
            name: player.name,
            avatar_seed: player.avatarSeed,
          });
          memberIds.push(member.id);
          
          if (!player.savedMemberId) {
            const idx = newPlayers.findIndex(p => p.id === player.id);
            if (idx !== -1) newPlayers[idx] = { ...player, savedMemberId: member.id };
          }
        }
        
        // update store if players got new savedMemberIds
        set({ players: newPlayers });

        // Insert room
        const newRoom = await dbRooms.insert(deviceId, roomName, state.rules, memberIds);
        set({ sessionSavedRoomId: newRoom.id });
        await get().archiveSession();
      },

      loadSavedRoom: async (roomId: string) => {
        const state = get();
        const room = await dbRooms.get(roomId);
        if (!room) throw new Error('room_not_found');

        const code = generateRoomCode();
        const now = Date.now();
        const updatedRecent = state.recentRooms.filter((r) => r.code !== code);
        updatedRecent.unshift({ code, name: room.name, lastActive: now });

        const activeMembers = (room.members ?? []).filter(m => m.avatar_seed !== '__DELETED__');
        const players: Player[] = activeMembers.map((m) => ({
          id: generateId(),
          name: m.name,
          avatarSeed: m.avatar_seed,
          savedMemberId: m.id,
        }));

        const rules = room.rules;
        const limit = rules.mode === '3-player' ? 3 : 4;
        const seats = initialSeats.slice(0, limit).map((s, i) => ({
          ...s,
          playerId: players[i]?.id ?? null,
        }));

        set({
          roomCode: code,
          roomName: room.name,
          rules,
          players,
          seats,
          rounds: [],
          viewingRoundId: null,
          currentPage: 'room',
          recentRooms: updatedRecent.slice(0, 10),
          sessionSavedRoomId: roomId,
          currentSessionDbId: null,
        });
      },

      archiveSession: async () => {
        const state = get();
        const deviceId = state.deviceId || getOrCreateDeviceId();
        const completedRounds = state.rounds.filter(
          (r) => r.status === 'completed' && r.results
        );
        if (completedRounds.length === 0) return;

        if (state.currentSessionDbId) {
          await dbSessions.update(state.currentSessionDbId, {
            saved_room_id: state.sessionSavedRoomId ?? null,
            room_name: state.roomName ?? 'Unnamed',
            rounds: completedRounds,
            players: state.players,
          });
        } else {
          const inserted = await dbSessions.insert({
            device_id: deviceId,
            saved_room_id: state.sessionSavedRoomId ?? null,
            room_name: state.roomName ?? 'Unnamed',
            rounds: completedRounds,
            players: state.players,
          });
          set({ currentSessionDbId: inserted.id });
        }
      },

      setViewingHistoryRoomId: (id) => set({ viewingHistoryRoomId: id }),
    }),
    {
      name: 'mahjong-scorer-storage',
      // Migrate old storage shape
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version < 2) {
          // 旧 'home' 页面值 → 新 'landing'
          if (state['currentPage'] === 'home') {
            state['currentPage'] = 'landing';
          }
        }
        return state as unknown as GameState;
      },
    }
  )
);
