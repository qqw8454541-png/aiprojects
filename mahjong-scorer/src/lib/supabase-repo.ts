/**
 * supabase-repo.ts — Supabase 云端适配器
 *
 * 实现 IRepository 接口，将现有 db.ts 逻辑封装为类。
 * 仅在 Web 端使用。
 */

import { supabase, authReady, refreshSession } from './supabase';
import { TIMING } from './session-policy';
import { useAuthStore } from './auth-store';
import { listUserDeviceIds } from './device-info';
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
  DbSessionRound,
} from './repository';

// ────────────────────────── Retry Wrapper ─────────────────────

/**
 * 包装异步操作，在遇到 auth/网络错误时自动重试。
 *
 * 流程：
 *  1. 执行 fn()
 *  2. 如果成功 → 返回结果
 *  3. 如果遇到 401/403/网络错误 → 刷新 session → 重试 (最多 maxRetries 次)
 *  4. 重试仍失败 → 抛出原始错误
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = TIMING.REPO_RETRY_MAX): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      // 判断是否是可恢复的错误
      const isRetryable = isRetryableError(err);
      if (!isRetryable || attempt >= maxRetries) break;

      // 尝试刷新 session 后重试
      console.warn(
        `[supabase-repo] Retryable error (attempt ${attempt + 1}/${maxRetries}):`,
        err instanceof Error ? err.message : err
      );
      await refreshSession();

      // 短暂等待让新 token 生效
      await new Promise((r) => setTimeout(r, TIMING.REPO_RETRY_BASE_DELAY_MS * (attempt + 1)));
    }
  }

  throw lastError;
}

/**
 * 判断错误是否值得重试
 */
function isRetryableError(err: unknown): boolean {
  if (!err) return false;

  // Supabase PostgREST 错误对象
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>;
    // HTTP status code based
    const code = obj.code as string | undefined;
    const status = obj.status as number | undefined;
    const message = (obj.message as string) || '';

    // 401 (Unauthorized) / 403 (Forbidden) — JWT expired or invalid
    if (status === 401 || status === 403) return true;
    if (code === '401' || code === '403') return true;
    // PGRST301 = JWT expired
    if (code === 'PGRST301') return true;

    // Network/fetch errors
    if (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('fetch')) {
      return true;
    }
    if (obj.name === 'AbortError' || obj.name === 'TypeError') return true;
  }

  // Generic Error instances
  if (err instanceof TypeError) return true; // fetch failures
  if (err instanceof DOMException && err.name === 'AbortError') return true;

  return false;
}


// ────────────────────────── Members ───────────────────────────

class SupabaseMemberRepository implements IMemberRepository {
  async list(deviceId: string): Promise<DbSavedMember[]> {
    return withRetry(async () => {
      await authReady;
      const { user, isPro } = useAuthStore.getState();
      let query = supabase.from('saved_members').select('*');
      
      if (user && isPro) {
        const deviceIds = await listUserDeviceIds(user.id);
        if (deviceIds.length > 0) {
          query = query.in('device_id', deviceIds);
        } else {
          query = query.eq('device_id', deviceId);
        }
      } else {
        query = query.eq('device_id', deviceId);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((m: DbSavedMember) => m.avatar_seed !== '__DELETED__');
    });
  }

  async upsert(member: Omit<DbSavedMember, 'created_at'>): Promise<DbSavedMember> {
    const { data, error } = await supabase
      .from('saved_members')
      .upsert({ ...member }, { onConflict: 'id' })
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

  async mergeMembers(targetId: string, sourceIds: string[]): Promise<void> {
    if (!sourceIds.length) return;
    
    // 1. Update session_players
    const { error: spErr } = await supabase
      .from('session_players')
      .update({ saved_member_id: targetId })
      .in('saved_member_id', sourceIds);
    if (spErr) throw spErr;

    // 2. Update room_members
    const allIds = [targetId, ...sourceIds];
    const { data: rmData } = await supabase
      .from('room_members')
      .select('room_id, member_id')
      .in('member_id', allIds);
    
    if (rmData && rmData.length > 0) {
      const roomMap = new Map<string, string[]>();
      for (const row of rmData) {
        if (!roomMap.has(row.room_id)) roomMap.set(row.room_id, []);
        roomMap.get(row.room_id)!.push(row.member_id);
      }
      
      for (const [roomId, members] of roomMap.entries()) {
        const hasTarget = members.includes(targetId);
        const sourceMembers = members.filter(m => sourceIds.includes(m));
        
        if (sourceMembers.length > 0) {
          if (hasTarget) {
            await supabase.from('room_members').delete().eq('room_id', roomId).in('member_id', sourceIds);
          } else {
            const firstSource = sourceMembers[0];
            await supabase.from('room_members').update({ member_id: targetId }).eq('room_id', roomId).eq('member_id', firstSource);
            if (sourceMembers.length > 1) {
              const remainingSourceIds = sourceMembers.slice(1);
              await supabase.from('room_members').delete().eq('room_id', roomId).in('member_id', remainingSourceIds);
            }
          }
        }
      }
    }

    // 3. Soft delete the source members
    const { error: smErr } = await supabase
      .from('saved_members')
      .update({ avatar_seed: '__DELETED__' })
      .in('id', sourceIds);
    if (smErr) throw smErr;
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
    return withRetry(async () => {
      await authReady;
      const { user, isPro } = useAuthStore.getState();
      let query = supabase
        .from('saved_rooms')
        .select(`
          *,
          room_members (
            sort_order,
            saved_members (*)
          )
        `);
        
      if (user && isPro) {
        const deviceIds = await listUserDeviceIds(user.id);
        if (deviceIds.length > 0) {
          query = query.in('device_id', deviceIds);
        } else {
          query = query.eq('device_id', deviceId);
        }
      } else {
        query = query.eq('device_id', deviceId);
      }
      
      const { data, error } = await query.order('updated_at', { ascending: false });
      if (error) throw error;

      return (data ?? []).map((room) => ({
        ...room,
        members: (room.room_members ?? [])
          .sort((a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order)
          .map((rm: { saved_members: DbSavedMember | DbSavedMember[] }) => {
            return Array.isArray(rm.saved_members) ? rm.saved_members[0] : rm.saved_members;
          }),
      }));
    });
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

  async mergeRooms(targetId: string, sourceIds: string[]): Promise<void> {
    if (!sourceIds.length) return;
    
    // 1. Update completed_sessions
    const { error: csErr } = await supabase
      .from('completed_sessions')
      .update({ saved_room_id: targetId })
      .in('saved_room_id', sourceIds);
    if (csErr) throw csErr;
    
    // 2. Add any unique members from source rooms to target room
    const { data: targetMembers } = await supabase.from('room_members').select('member_id, sort_order').eq('room_id', targetId);
    const targetMemberIds = new Set(targetMembers?.map(m => m.member_id) || []);
    let maxSortOrder = targetMembers?.length ? Math.max(...targetMembers.map(m => m.sort_order)) : -1;
    
    const { data: sourceMembers } = await supabase.from('room_members').select('member_id').in('room_id', sourceIds);
    const newMembers = new Set<string>();
    for (const sm of sourceMembers || []) {
      if (!targetMemberIds.has(sm.member_id)) {
        newMembers.add(sm.member_id);
        targetMemberIds.add(sm.member_id);
      }
    }
    
    if (newMembers.size > 0) {
      const insertRows = Array.from(newMembers).map(memberId => ({
        room_id: targetId,
        member_id: memberId,
        sort_order: ++maxSortOrder
      }));
      await supabase.from('room_members').insert(insertRows);
    }
    
    // 3. Delete source rooms
    const { error: srErr } = await supabase.from('saved_rooms').delete().in('id', sourceIds);
    if (srErr) throw srErr;
  }
}

// ────────────────────────── Sessions ──────────────────────────

class SupabaseSessionRepository implements ISessionRepository {
  async list(deviceId: string, savedRoomId?: string): Promise<DbCompletedSession[]> {
    return withRetry(async () => {
      await authReady;
      const { user, isPro } = useAuthStore.getState();

      // Single nested query: fetch sessions with players, rounds, and round results in one request
      let query = supabase
        .from('completed_sessions')
        .select(`
          *,
          session_players (*),
          session_rounds (
            *,
            round_player_results (*)
          )
        `);

      if (user && isPro) {
        const deviceIds = await listUserDeviceIds(user.id);
        if (deviceIds.length > 0) {
          query = query.in('device_id', deviceIds);
        } else {
          query = query.eq('device_id', deviceId);
        }
      } else {
        query = query.eq('device_id', deviceId);
      }
      
      query = query.order('played_at', { ascending: false });

      if (savedRoomId) {
        query = query.eq('saved_room_id', savedRoomId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((row: any) => {
        // Sort and map session_players
        const sessionPlayers = (row.session_players ?? [])
          .sort((a: any, b: any) => (a.seat_index ?? 0) - (b.seat_index ?? 0));

        // Sort and map session_rounds with nested results
        const sessionRounds: DbSessionRound[] = (row.session_rounds ?? [])
          .sort((a: any, b: any) => a.round_number - b.round_number)
          .map((rd: any) => ({
            ...rd,
            start_time: Number(rd.start_time),
            end_time: rd.end_time ? Number(rd.end_time) : undefined,
            results: (rd.round_player_results ?? [])
              .sort((a: any, b: any) => a.rank - b.rank)
              .map((r: any) => ({
                ...r,
                pt: Number(r.pt),
              })),
          }));

        // Clean up the nested keys from the row
        const { session_players, session_rounds, ...sessionBase } = row;

        return {
          ...sessionBase,
          sessionRounds,
          sessionPlayers,
        } as DbCompletedSession;
      });
    });
  }


  async insert(
    session: Omit<DbCompletedSession, 'id' | 'played_at'>
  ): Promise<DbCompletedSession> {
    // 1. Insert session base row
    const { data: sessionRow, error: sessionErr } = await supabase
      .from('completed_sessions')
      .insert({
        device_id: session.device_id,
        saved_room_id: session.saved_room_id,
        room_name: session.room_name,
      })
      .select()
      .single();
    if (sessionErr) throw sessionErr;

    const sessionId = sessionRow.id;

    // 2. Insert session players
    if (session.sessionPlayers && session.sessionPlayers.length > 0) {
      const playerRows = session.sessionPlayers.map((p, i) => ({
        session_id: sessionId,
        player_id: p.player_id,
        player_name: p.player_name,
        avatar_seed: p.avatar_seed,
        saved_member_id: p.saved_member_id || null,
        seat_index: p.seat_index ?? i,
      }));
      const { error: pErr } = await supabase.from('session_players').insert(playerRows);
      if (pErr) throw pErr;
    }

    // 3. Insert session rounds + round player results
    if (session.sessionRounds && session.sessionRounds.length > 0) {
      for (const round of session.sessionRounds) {
        const { data: roundRow, error: rErr } = await supabase
          .from('session_rounds')
          .insert({
            session_id: sessionId,
            round_number: round.round_number,
            status: round.status,
            start_time: round.start_time,
            end_time: round.end_time ?? null,
          })
          .select()
          .single();
        if (rErr) throw rErr;

        if (round.results && round.results.length > 0) {
          const resultRows = round.results.map((r) => ({
            round_id: roundRow.id,
            player_id: r.player_id,
            player_name: r.player_name,
            wind: r.wind,
            raw_score: r.raw_score,
            rank: r.rank,
            pt: r.pt,
          }));
          const { error: rrErr } = await supabase.from('round_player_results').insert(resultRows);
          if (rrErr) throw rrErr;
        }
      }
    }

    return {
      ...sessionRow,
      sessionRounds: session.sessionRounds,
      sessionPlayers: session.sessionPlayers,
    };
  }

  async update(
    id: string,
    updates: Partial<Omit<DbCompletedSession, 'id' | 'device_id' | 'played_at'>>
  ): Promise<void> {
    // Update base fields if provided
    const baseUpdates: Record<string, unknown> = {};
    if (updates.saved_room_id !== undefined) baseUpdates.saved_room_id = updates.saved_room_id;
    if (updates.room_name !== undefined) baseUpdates.room_name = updates.room_name;

    if (Object.keys(baseUpdates).length > 0) {
      const { error } = await supabase.from('completed_sessions').update(baseUpdates).eq('id', id);
      if (error) throw error;
    }

    // Replace session players if provided
    if (updates.sessionPlayers !== undefined) {
      await supabase.from('session_players').delete().eq('session_id', id);
      if (updates.sessionPlayers.length > 0) {
        const playerRows = updates.sessionPlayers.map((p, i) => ({
          session_id: id,
          player_id: p.player_id,
          player_name: p.player_name,
          avatar_seed: p.avatar_seed,
          saved_member_id: p.saved_member_id || null,
          seat_index: p.seat_index ?? i,
        }));
        const { error: pErr } = await supabase.from('session_players').insert(playerRows);
        if (pErr) throw pErr;
      }
    }

    // Replace session rounds if provided
    if (updates.sessionRounds !== undefined) {
      // Cascade: deleting rounds will also delete round_player_results
      await supabase.from('session_rounds').delete().eq('session_id', id);

      for (const round of updates.sessionRounds) {
        const { data: roundRow, error: rErr } = await supabase
          .from('session_rounds')
          .insert({
            session_id: id,
            round_number: round.round_number,
            status: round.status,
            start_time: round.start_time,
            end_time: round.end_time ?? null,
          })
          .select()
          .single();
        if (rErr) throw rErr;

        if (round.results && round.results.length > 0) {
          const resultRows = round.results.map((r) => ({
            round_id: roundRow.id,
            player_id: r.player_id,
            player_name: r.player_name,
            wind: r.wind,
            raw_score: r.raw_score,
            rank: r.rank,
            pt: r.pt,
          }));
          const { error: rrErr } = await supabase.from('round_player_results').insert(resultRows);
          if (rrErr) throw rrErr;
        }
      }
    }
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
