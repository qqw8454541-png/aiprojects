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
}

export interface DbSavedRoom {
  id: string;
  device_id: string;
  name: string;
  rules: RuleConfig;
  created_at: string;
  updated_at: string;
  members?: DbSavedMember[]; // joined
}

export interface DbCompletedSession {
  id: string;
  device_id: string;
  saved_room_id: string | null;
  room_name: string;
  rounds: unknown[];
  players: unknown[];
  played_at: string;
}

// ────────────────────────── Interfaces ─────────────────────────

export interface IMemberRepository {
  list(deviceId: string): Promise<DbSavedMember[]>;
  upsert(member: Omit<DbSavedMember, 'created_at'>): Promise<DbSavedMember>;
  delete(id: string): Promise<void>;
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
}

export interface ISessionRepository {
  list(deviceId: string, savedRoomId?: string): Promise<DbCompletedSession[]>;
  insert(
    session: Omit<DbCompletedSession, 'id' | 'played_at'>
  ): Promise<DbCompletedSession>;
  update(
    id: string,
    updates: Partial<Omit<DbCompletedSession, 'id' | 'device_id' | 'played_at'>>
  ): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IRepository {
  members: IMemberRepository;
  rooms: IRoomRepository;
  roomMembers: IRoomMemberRepository;
  sessions: ISessionRepository;
}
