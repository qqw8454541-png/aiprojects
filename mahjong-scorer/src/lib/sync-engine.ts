import { getRepository } from './repo-factory';
import { supabase } from './supabase';
import { useAuthStore } from './auth-store';
import { useGameStore } from './store';

export interface SyncProgress {
  phase: 'preparing' | 'uploading' | 'downloading' | 'merging' | 'done' | 'error';
  current: number;
  total: number;
  message: string;
}

// ── Sync state event bus ─────────────────────────────────────
// 让 UI 组件（如 SyncOverlay）能监听同步状态变更。
type SyncListener = (isSyncing: boolean) => void;
const _syncListeners: Set<SyncListener> = new Set();

export function onSyncStateChange(listener: SyncListener): () => void {
  _syncListeners.add(listener);
  return () => { _syncListeners.delete(listener); };
}

function notifySyncState(isSyncing: boolean) {
  _syncListeners.forEach((fn) => {
    try { fn(isSyncing); } catch (e) { console.error('[sync-engine] listener error:', e); }
  });
}

/** 增量同步的定期触发间隔 (ms) — 5 分钟 */
const PERIODIC_SYNC_INTERVAL_MS = 5 * 60 * 1000;

class SyncEngine {
  private isRunning: boolean = false;
  private periodicTimer: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;

  private async getLocalRepo() {
    const repo = await getRepository();
    // In native context, getRepository returns LocalRepository which has exportAllMembers etc.
    return repo as any;
  }

  // Called when upgrading to Pro
  async fullSync(onProgress: (p: SyncProgress) => void): Promise<{ success: boolean; error?: string }> {
    if (this.isRunning) return { success: false, error: 'Already syncing' };
    this.isRunning = true;
    notifySyncState(true);
    
    try {
      const { user, isPro } = useAuthStore.getState();
      if (!user || !isPro) throw new Error('User is not Pro');

      const deviceId = useGameStore.getState().deviceId;
      if (!deviceId) throw new Error('Device ID not found');

      const localRepo = await this.getLocalRepo();
      if (!localRepo.exportAllMembers) throw new Error('Local repository not available for sync');

      // 1. Preparing
      onProgress({ phase: 'preparing', current: 0, total: 100, message: 'Preparing data...' });
      
      const localMembers = await localRepo.exportAllMembers();
      const localRooms = await localRepo.exportAllRooms();
      const localSessions = await localRepo.exportAllSessions();

      let currentStep = 0;
      const totalSteps = localMembers.length + localRooms.length + localSessions.length + 3; // +3 for download steps

      // 2. Uploading
      onProgress({ phase: 'uploading', current: currentStep, total: totalSteps, message: 'Uploading members...' });
      
      for (const m of localMembers) {
        await supabase.from('saved_members').upsert({
          id: m.id,
          device_id: m.device_id,
          name: m.name,
          avatar_seed: m.avatar_seed,
          created_at: m.created_at,
          updated_at: m.updated_at,
          deleted_at: m.deleted_at
        }, { onConflict: 'id' });
        currentStep++;
        onProgress({ phase: 'uploading', current: currentStep, total: totalSteps, message: `Uploading members...` });
      }

      onProgress({ phase: 'uploading', current: currentStep, total: totalSteps, message: 'Uploading rooms...' });
      for (const r of localRooms) {
        await supabase.from('saved_rooms').upsert({
          id: r.id,
          device_id: r.device_id,
          name: r.name,
          rules: r.rules,
          created_at: r.created_at,
          updated_at: r.updated_at,
          deleted_at: r.deleted_at
        }, { onConflict: 'id' });
        
        if (r.members && r.members.length > 0) {
          await supabase.from('room_members').delete().eq('room_id', r.id);
          const rmRows = r.members.map((m: any, i: number) => ({
            room_id: r.id,
            member_id: m.id,
            sort_order: i
          }));
          await supabase.from('room_members').insert(rmRows);
        }
        currentStep++;
        onProgress({ phase: 'uploading', current: currentStep, total: totalSteps, message: `Uploading rooms...` });
      }

      onProgress({ phase: 'uploading', current: currentStep, total: totalSteps, message: 'Uploading sessions...' });
      for (const s of localSessions) {
        // Since sessions are mostly append-only, we skip if exists
        const { data: existing } = await supabase.from('completed_sessions').select('id').eq('id', s.id).single();
        if (!existing) {
          await supabase.from('completed_sessions').insert({
            id: s.id,
            device_id: s.device_id,
            saved_room_id: s.saved_room_id,
            room_name: s.room_name,
            played_at: s.played_at
          });

          if (s.sessionPlayers && s.sessionPlayers.length > 0) {
            const spRows = s.sessionPlayers.map((sp: any) => ({
              id: sp.id,
              session_id: s.id,
              player_id: sp.player_id,
              player_name: sp.player_name,
              avatar_seed: sp.avatar_seed,
              saved_member_id: sp.saved_member_id,
              seat_index: sp.seat_index
            }));
            await supabase.from('session_players').insert(spRows);
          }

          if (s.sessionRounds && s.sessionRounds.length > 0) {
            for (const sr of s.sessionRounds) {
              await supabase.from('session_rounds').insert({
                id: sr.id,
                session_id: s.id,
                round_number: sr.round_number,
                status: sr.status,
                start_time: sr.start_time,
                end_time: sr.end_time
              });

              if (sr.results && sr.results.length > 0) {
                const resRows = sr.results.map((rr: any) => ({
                  id: rr.id,
                  round_id: sr.id,
                  player_id: rr.player_id,
                  player_name: rr.player_name,
                  wind: rr.wind,
                  raw_score: rr.raw_score,
                  rank: rr.rank,
                  pt: rr.pt
                }));
                await supabase.from('round_player_results').insert(resRows);
              }
            }
          }
        }
        currentStep++;
        onProgress({ phase: 'uploading', current: currentStep, total: totalSteps, message: `Uploading sessions...` });
      }

      // 3. Downloading remote data
      onProgress({ phase: 'downloading', current: currentStep, total: totalSteps, message: 'Downloading remote data...' });
      await this.pullRemoteData(user.id, deviceId, localRepo);
      currentStep += 3;
      
      onProgress({ phase: 'done', current: totalSteps, total: totalSteps, message: 'Sync complete' });
      
      const now = new Date().toISOString();
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`last_synced_${user.id}`, now);
      }
      
      return { success: true };
    } catch (err: any) {
      onProgress({ phase: 'error', current: 0, total: 100, message: err.message });
      return { success: false, error: err.message };
    } finally {
      this.isRunning = false;
      notifySyncState(false);
    }
  }

  // Background incremental sync
  async incrementalSync(): Promise<void> {
    if (this.isRunning) return;
    const { user, isPro } = useAuthStore.getState();
    if (!user || !isPro) return;
    
    const deviceId = useGameStore.getState().deviceId;
    if (!deviceId) return;

    this.isRunning = true;
    notifySyncState(true);
    try {
      const localRepo = await this.getLocalRepo();
      if (!localRepo.exportAllMembers) return; // not native

      // Upload phase: push changes since last sync
      let lastSynced = '1970-01-01T00:00:00Z';
      if (typeof window !== 'undefined') {
        lastSynced = window.localStorage.getItem(`last_synced_${user.id}`) || lastSynced;
      }

      // Simplified approach for incremental: re-upload recently updated local records
      const localMembers = await localRepo.exportAllMembers();
      const localRooms = await localRepo.exportAllRooms();
      const localSessions = await localRepo.exportAllSessions();

      const membersToPush = localMembers.filter((m: any) => m.updated_at > lastSynced);
      for (const m of membersToPush) {
        await supabase.from('saved_members').upsert({
          id: m.id, device_id: m.device_id, name: m.name, avatar_seed: m.avatar_seed,
          created_at: m.created_at, updated_at: m.updated_at, deleted_at: m.deleted_at
        }, { onConflict: 'id' });
      }

      const roomsToPush = localRooms.filter((r: any) => r.updated_at > lastSynced);
      for (const r of roomsToPush) {
        await supabase.from('saved_rooms').upsert({
          id: r.id, device_id: r.device_id, name: r.name, rules: r.rules,
          created_at: r.created_at, updated_at: r.updated_at, deleted_at: r.deleted_at
        }, { onConflict: 'id' });
        
        if (r.members) {
          await supabase.from('room_members').delete().eq('room_id', r.id);
          const rmRows = r.members.map((m: any, i: number) => ({ room_id: r.id, member_id: m.id, sort_order: i }));
          if (rmRows.length > 0) await supabase.from('room_members').insert(rmRows);
        }
      }

      const sessionsToPush = localSessions.filter((s: any) => s.played_at > lastSynced);
      for (const s of sessionsToPush) {
        const { data: existing } = await supabase.from('completed_sessions').select('id').eq('id', s.id).single();
        if (!existing) {
          await supabase.from('completed_sessions').insert({
            id: s.id, device_id: s.device_id, saved_room_id: s.saved_room_id,
            room_name: s.room_name, played_at: s.played_at
          });

          if (s.sessionPlayers && s.sessionPlayers.length > 0) {
            const spRows = s.sessionPlayers.map((sp: any) => ({
              id: sp.id, session_id: s.id, player_id: sp.player_id, player_name: sp.player_name,
              avatar_seed: sp.avatar_seed, saved_member_id: sp.saved_member_id, seat_index: sp.seat_index
            }));
            await supabase.from('session_players').insert(spRows);
          }

          if (s.sessionRounds && s.sessionRounds.length > 0) {
            for (const sr of s.sessionRounds) {
              await supabase.from('session_rounds').insert({
                id: sr.id, session_id: s.id, round_number: sr.round_number, status: sr.status,
                start_time: sr.start_time, end_time: sr.end_time
              });

              if (sr.results && sr.results.length > 0) {
                const resRows = sr.results.map((rr: any) => ({
                  id: rr.id, round_id: sr.id, player_id: rr.player_id, player_name: rr.player_name,
                  wind: rr.wind, raw_score: rr.raw_score, rank: rr.rank, pt: rr.pt
                }));
                await supabase.from('round_player_results').insert(resRows);
              }
            }
          }
        }
      }

      // Download phase — 完整实现
      await this.pullRemoteData(user.id, deviceId, localRepo, lastSynced);

      const now = new Date().toISOString();
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`last_synced_${user.id}`, now);
      }
    } catch (e) {
      console.error('Incremental sync failed', e);
    } finally {
      this.isRunning = false;
      notifySyncState(false);
    }
  }

  // Push single change (called directly after local edits if online)
  async pushChange(table: 'saved_members' | 'saved_rooms' | 'completed_sessions', id: string): Promise<void> {
    if (typeof window !== 'undefined' && !navigator.onLine) return;
    const { user, isPro } = useAuthStore.getState();
    if (!user || !isPro) return;

    // A lightweight wrapper to just trigger incremental sync which will find the change
    // Using a timeout to debounce multiple rapid changes
    setTimeout(() => {
      this.incrementalSync();
    }, 2000);
  }

  private async pullRemoteData(userId: string, currentDeviceId: string, localRepo: any, since: string = '1970-01-01T00:00:00Z') {
    // 1. Get user devices
    const { data: devices } = await supabase.from('user_devices').select('device_id').eq('user_id', userId);
    if (!devices || devices.length === 0) return;
    
    const deviceIds = devices.map(d => d.device_id).filter(id => id !== currentDeviceId);
    if (deviceIds.length === 0) return;

    // 2. Fetch and import remote members
    const { data: remoteMembers } = await supabase
      .from('saved_members')
      .select('*')
      .in('device_id', deviceIds)
      .gt('updated_at', since);

    if (remoteMembers && localRepo.importMember) {
      for (const m of remoteMembers) {
        try {
          await localRepo.importMember(m);
        } catch (e) {
          console.warn('[sync] Failed to import member:', m.id, e);
        }
      }
    }

    // 3. Fetch and import remote rooms (with members)
    const { data: remoteRooms } = await supabase
      .from('saved_rooms')
      .select(`
        *,
        room_members (
          sort_order,
          saved_members (*)
        )
      `)
      .in('device_id', deviceIds)
      .gt('updated_at', since);

    if (remoteRooms && localRepo.importRoom) {
      for (const room of remoteRooms) {
        try {
          // Transform the joined data to match DbSavedRoom shape
          const members = (room.room_members ?? [])
            .sort((a: any, b: any) => a.sort_order - b.sort_order)
            .map((rm: any) => Array.isArray(rm.saved_members) ? rm.saved_members[0] : rm.saved_members)
            .filter(Boolean);

          await localRepo.importRoom({ ...room, members, rules: room.rules });
        } catch (e) {
          console.warn('[sync] Failed to import room:', room.id, e);
        }
      }
    }

    // 4. Fetch and import remote sessions
    const { data: remoteSessions } = await supabase
      .from('completed_sessions')
      .select('*')
      .in('device_id', deviceIds)
      .gt('played_at', since);

    if (remoteSessions && localRepo.importSession) {
      for (const session of remoteSessions) {
        try {
          // Fetch session players
          const { data: playersData } = await supabase
            .from('session_players')
            .select('*')
            .eq('session_id', session.id)
            .order('seat_index', { ascending: true });

          // Fetch session rounds with nested results
          const { data: roundsData } = await supabase
            .from('session_rounds')
            .select('*')
            .eq('session_id', session.id)
            .order('round_number', { ascending: true });

          const sessionRounds = [];
          for (const rd of roundsData ?? []) {
            const { data: resultsData } = await supabase
              .from('round_player_results')
              .select('*')
              .eq('round_id', rd.id)
              .order('rank', { ascending: true });

            sessionRounds.push({
              ...rd,
              start_time: Number(rd.start_time),
              end_time: rd.end_time ? Number(rd.end_time) : undefined,
              results: (resultsData ?? []).map((r: any) => ({
                ...r,
                pt: Number(r.pt),
              })),
            });
          }

          await localRepo.importSession({
            ...session,
            sessionRounds,
            sessionPlayers: playersData ?? [],
          });
        } catch (e) {
          console.warn('[sync] Failed to import session:', session.id, e);
        }
      }
    }
  }

  // ── Periodic Sync Lifecycle ─────────────────────────────────

  /**
   * 启动定期增量同步。
   * 在 native 端 Pro 用户登录后由 SyncProvider 调用。
   * 同时注册 visibilitychange 事件，在 App 唤醒时触发同步。
   */
  startPeriodicSync(): void {
    this.stopPeriodicSync(); // 防止重复

    // 定期触发
    this.periodicTimer = setInterval(() => {
      this.incrementalSync();
    }, PERIODIC_SYNC_INTERVAL_MS);

    // App 唤醒时触发
    this.visibilityHandler = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        // 延迟 1 秒等待网络恢复
        setTimeout(() => {
          this.incrementalSync();
        }, 1000);
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityHandler);
    }

    // 立即执行一次
    this.incrementalSync();
  }

  /**
   * 停止定期同步（用户登出或组件卸载时调用）。
   */
  stopPeriodicSync(): void {
    if (this.periodicTimer) {
      clearInterval(this.periodicTimer);
      this.periodicTimer = null;
    }
    if (this.visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }
}

export const syncEngine = new SyncEngine();
