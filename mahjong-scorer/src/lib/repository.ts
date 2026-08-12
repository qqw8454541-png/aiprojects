/**
 * repository.ts — 统一数据操作接口定义
 *
 * 与平台无关的抽象层。Web 端由 SupabaseRepository 实现，
 * Android/iOS 端由 LocalRepository (SQLite) 实现。
 *
 * 类型定义（DbSavedMember 等）从此文件统一导出，
 * 替代原来从 db.ts 导出的方式。
 */

import type { RuleConfig } from './rules';

// ────────────────────────── Types ──────────────────────────────

export interface DbSavedMember {
  id: string;
  device_id: string;
  name: string;
  avatar_seed: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface DbSavedRoom {
  id: string;
  device_id: string;
  name: string;
  rules: RuleConfig;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  members?: DbSavedMember[]; // joined
}

/** 对局回合（拆分自原 completed_sessions.rounds JSONB） */
export interface DbSessionRound {
  id: string;
  session_id: string;
  round_number: number;
  status: 'completed' | 'in_progress';
  start_time: number;   // epoch ms
  end_time?: number;     // epoch ms
  /** 该回合的玩家成绩（JOIN 查询时填充） */
  results?: DbRoundPlayerResult[];
}

/** 每局每个玩家的成绩（拆分自原 RoundResult.results JSONB 数组） */
export interface DbRoundPlayerResult {
  id: string;
  round_id: string;
  player_id: string;     // 对局内临时 ID
  player_name: string;
  wind: string;          // 'east' | 'south' | 'west' | 'north'
  raw_score: number;     // e.g. 35500
  rank: number;          // 1-4
  pt: number;            // e.g. 45.5
}

/** 对局参与玩家（拆分自原 completed_sessions.players JSONB） */
export interface DbSessionPlayer {
  id: string;
  session_id: string;
  player_id: string;         // 对局内临时 ID
  player_name: string;
  avatar_seed: string;
  saved_member_id?: string;  // FK → saved_members
  seat_index?: number;       // 座位顺序 0-3
}

/** completed_sessions 基础行（不含 JSONB，结构化数据通过关联表获取） */
export interface DbCompletedSession {
  id: string;
  device_id: string;
  saved_room_id: string | null;
  room_name: string;
  played_at: string;
  /** 关联的结构化回合数据（JOIN 查询时填充） */
  sessionRounds?: DbSessionRound[];
  /** 关联的结构化玩家数据（JOIN 查询时填充） */
  sessionPlayers?: DbSessionPlayer[];
}

// ────────────────────────── Interfaces ─────────────────────────

export interface IMemberRepository {
  list(deviceId: string): Promise<DbSavedMember[]>;
  upsert(member: Omit<DbSavedMember, 'created_at'>): Promise<DbSavedMember>;
  delete(id: string): Promise<void>;
  mergeMembers(targetId: string, sourceIds: string[]): Promise<void>;
}

export interface IRoomMemberRepository {
  listByRoom(roomId: string): Promise<DbSavedMember[]>;
  set(roomId: string, memberIds: string[]): Promise<void>;
}

export interface IRoomRepository {
  list(deviceId: string): Promise<DbSavedRoom[]>;
  get(id: string): Promise<DbSavedRoom | null>;
  insert(
    deviceId: string,
    name: string,
    rules: RuleConfig,
    memberIds: string[]
  ): Promise<DbSavedRoom>;
  update(
    id: string,
    patch: Partial<{ name: string; rules: RuleConfig }>
  ): Promise<void>;
  delete(id: string): Promise<void>;
  mergeRooms(targetId: string, sourceIds: string[]): Promise<void>;
}

export interface ISessionRepository {
  /** 列出对局（含关联的 sessionRounds + sessionPlayers） */
  list(deviceId: string, savedRoomId?: string): Promise<DbCompletedSession[]>;
  /** 插入对局基础行 + 关联的回合/玩家数据 */
  insert(
    session: Omit<DbCompletedSession, 'id' | 'played_at'>,
  ): Promise<DbCompletedSession>;
  /** 更新对局（含删除+重建关联回合/玩家数据） */
  update(
    id: string,
    updates: Partial<Omit<DbCompletedSession, 'id' | 'device_id' | 'played_at'>>,
  ): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IRepository {
  members: IMemberRepository;
  rooms: IRoomRepository;
  roomMembers: IRoomMemberRepository;
  sessions: ISessionRepository;
  
  exportAllMembers?(): Promise<DbSavedMember[]>;
  exportAllRooms?(): Promise<DbSavedRoom[]>;
  exportAllSessions?(): Promise<DbCompletedSession[]>;
}
