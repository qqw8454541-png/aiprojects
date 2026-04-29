/**
 * db.ts — Supabase CRUD 操作集中管理
 *
 * 所有数据以 deviceId 为匿名所有者标识。
 * deviceId 由调用方从 localStorage 取得后传入。
 */

import { supabase } from './supabase';
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

// ────────────────────────── saved_members ──────────────────────

export const dbMembers = {
  /** 取得该设备所有成员 */
  async list(deviceId: string): Promise<DbSavedMember[]> {
    const { data, error } = await supabase
      .from('saved_members')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).filter((m: DbSavedMember) => m.avatar_seed !== '__DELETED__');
  },

  /** 新增或更新成员（按 id upsert） */
  async upsert(member: Omit<DbSavedMember, 'created_at'>): Promise<DbSavedMember> {
    const { data, error } = await supabase
      .from('saved_members')
      .upsert(member, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** 删除成员（软删除，标记为 __DELETED__，保留在对局房间中） */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('saved_members')
      .update({ avatar_seed: '__DELETED__' })
      .eq('id', id);
    if (error) throw error;
  },
};

// ────────────────────────── room_members ───────────────────────

export const dbRoomMembers = {
  /** 取得某房间的所有成员 */
  async listByRoom(roomId: string): Promise<DbSavedMember[]> {
    const { data, error } = await supabase
      .from('room_members')
      .select('sort_order, saved_members(*)')
      .eq('room_id', roomId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data ?? []).map((row: { sort_order: number; saved_members: DbSavedMember | DbSavedMember[] }) => {
      const m = row.saved_members;
      return Array.isArray(m) ? m[0] : m;
    });
  },

  /** 覆写某房间的成员列表（先删后插） */
  async set(roomId: string, memberIds: string[]): Promise<void> {
    // 先删除该房间所有关联
    const { error: delErr } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId);
    if (delErr) throw delErr;

    if (memberIds.length === 0) return;

    const rows = memberIds.map((memberId, i) => ({
      room_id: roomId,
      member_id: memberId,
      sort_order: i,
    }));
    const { error: insErr } = await supabase.from('room_members').insert(rows);
    if (insErr) throw insErr;
  },
};

// ────────────────────────── saved_rooms ────────────────────────

export const dbRooms = {
  /** 取得该设备所有已存房间（含成员列表） */
  async list(deviceId: string): Promise<DbSavedRoom[]> {
    const { data, error } = await supabase
      .from('saved_rooms')
      .select(`
        *,
        room_members (
          sort_order,
          saved_members (*)
        )
      `)
      .eq('device_id', deviceId)
      .order('updated_at', { ascending: false });
    if (error) throw error;

    return (data ?? []).map((room) => ({
      ...room,
      members: (room.room_members ?? [])
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        .map((rm: { saved_members: DbSavedMember | DbSavedMember[] }) => {
          return Array.isArray(rm.saved_members) ? rm.saved_members[0] : rm.saved_members;
        }),
    }));
  },

  /** 取得单个房间（含成员） */
  async get(id: string): Promise<DbSavedRoom | null> {
    const { data, error } = await supabase
      .from('saved_rooms')
      .select(`
        *,
        room_members (
          sort_order,
          saved_members (*)
        )
      `)
      .eq('id', id)
      .single();
    if (error) return null;
    return {
      ...data,
      members: (data.room_members ?? [])
        .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
        .map((rm: { saved_members: DbSavedMember | DbSavedMember[] }) => {
          return Array.isArray(rm.saved_members) ? rm.saved_members[0] : rm.saved_members;
        }),
    };
  },

  /** 新增房间（返回新建的房间记录） */
  async insert(
    deviceId: string,
    name: string,
    rules: RuleConfig,
    memberIds: string[]
  ): Promise<DbSavedRoom> {
    const { data, error } = await supabase
      .from('saved_rooms')
      .insert({ device_id: deviceId, name, rules })
      .select()
      .single();
    if (error) throw error;
    await dbRoomMembers.set(data.id, memberIds);
    return { ...data, members: [] };
  },

  /** 更新房间名和/或规则 */
  async update(
    id: string,
    patch: Partial<{ name: string; rules: RuleConfig }>
  ): Promise<void> {
    const { error } = await supabase.from('saved_rooms').update(patch).eq('id', id);
    if (error) throw error;
  },

  /** 删除房间（room_members 会级联删除） */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('saved_rooms').delete().eq('id', id);
    if (error) throw error;
  },
};

// ────────────────────────── completed_sessions ─────────────────

export const dbSessions = {
  /** 取得该设备（可选：某房间）的所有对局归档 */
  async list(deviceId: string, savedRoomId?: string): Promise<DbCompletedSession[]> {
    let query = supabase
      .from('completed_sessions')
      .select('*')
      .eq('device_id', deviceId)
      .order('played_at', { ascending: false });

    if (savedRoomId) {
      query = query.eq('saved_room_id', savedRoomId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  /** 插入一条对局归档 */
  async insert(session: Omit<DbCompletedSession, 'id' | 'played_at'>): Promise<DbCompletedSession> {
    const { data, error } = await supabase
      .from('completed_sessions')
      .insert(session)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** 更新已有归档 */
  async update(id: string, updates: Partial<Omit<DbCompletedSession, 'id' | 'device_id' | 'played_at'>>): Promise<void> {
    const { error } = await supabase
      .from('completed_sessions')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },

  /** 删除单条归档 */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('completed_sessions').delete().eq('id', id);
    if (error) throw error;
  },
};
