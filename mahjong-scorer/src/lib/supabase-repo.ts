/**
 * supabase-repo.ts — Supabase 云端适配器
 *
 * 实现 IRepository 接口，将现有 db.ts 逻辑封装为类。
 * 仅在 Web 端使用。
 */

import { supabase } from './supabase';
import type { RuleConfig } from './rules';
import type {
  IRepository,
  IMemberRepository,
  IRoomMemberRepository,
  IRoomRepository,
  ISessionRepository,
  DbSavedMember,
  DbSavedRoom,
  DbCompletedSession,
} from './repository';

// ────────────────────────── Members ───────────────────────────

class SupabaseMemberRepository implements IMemberRepository {
  async list(deviceId: string): Promise<DbSavedMember[]> {
    const { data, error } = await supabase
      .from('saved_members')
      .select('*')
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).filter((m: DbSavedMember) => m.avatar_seed !== '__DELETED__');
  }

  async upsert(member: Omit<DbSavedMember, 'created_at'>): Promise<DbSavedMember> {
    const { data, error } = await supabase
      .from('saved_members')
      .upsert(member, { onConflict: 'id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('saved_members')
      .update({ avatar_seed: '__DELETED__' })
      .eq('id', id);
    if (error) throw error;
  }
}

// ────────────────────────── Room Members ──────────────────────

class SupabaseRoomMemberRepository implements IRoomMemberRepository {
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
  }

  async set(roomId: string, memberIds: string[]): Promise<void> {
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
  }
}

// ────────────────────────── Rooms ─────────────────────────────

class SupabaseRoomRepository implements IRoomRepository {
  private roomMembers = new SupabaseRoomMemberRepository();

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
  }

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
  }

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
    await this.roomMembers.set(data.id, memberIds);
    return { ...data, members: [] };
  }

  async update(
    id: string,
    patch: Partial<{ name: string; rules: RuleConfig }>
  ): Promise<void> {
    const { error } = await supabase.from('saved_rooms').update(patch).eq('id', id);
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('saved_rooms').delete().eq('id', id);
    if (error) throw error;
  }
}

// ────────────────────────── Sessions ──────────────────────────

class SupabaseSessionRepository implements ISessionRepository {
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
  }

  async insert(
    session: Omit<DbCompletedSession, 'id' | 'played_at'>
  ): Promise<DbCompletedSession> {
    const { data, error } = await supabase
      .from('completed_sessions')
      .insert(session)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async update(
    id: string,
    updates: Partial<Omit<DbCompletedSession, 'id' | 'device_id' | 'played_at'>>
  ): Promise<void> {
    const { error } = await supabase
      .from('completed_sessions')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('completed_sessions').delete().eq('id', id);
    if (error) throw error;
  }
}

// ────────────────────────── Composite ─────────────────────────

export class SupabaseRepository implements IRepository {
  members = new SupabaseMemberRepository();
  rooms = new SupabaseRoomRepository();
  roomMembers = new SupabaseRoomMemberRepository();
  sessions = new SupabaseSessionRepository();
}
