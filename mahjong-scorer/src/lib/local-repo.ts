/**
 * local-repo.ts — SQLite 本地适配器
 *
 * 实现 IRepository 接口，使用 @capacitor-community/sqlite 在
 * Android/iOS 上提供完全离线的本地数据存储。
 *
 * 表结构与 Supabase 云端保持一致，方便未来扩展云端同步。
 */

import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
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

// ── Runtime guard ─────────────────────────────────────────────
// This module must ONLY be loaded on native platforms (Android/iOS).
// repo-factory.ts uses dynamic import() to ensure this never runs on Web,
// but this guard acts as a safety net in case of accidental static imports.
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cap = (window as any).Capacitor;
  const platform: string | undefined =
    cap && typeof cap.getPlatform === 'function' ? cap.getPlatform() : undefined;
  if (!platform || platform === 'web') {
    throw new Error(
      '[local-repo] This module requires a native Capacitor environment (Android/iOS). ' +
      'It must not be imported on Web. Check repo-factory.ts for correct dynamic import usage.'
    );
  }
}

// ────────────────────────── Helpers ────────────────────────────

function uuid(): string {
  // crypto.randomUUID is available in secure contexts;
  // fallback for older WebViews
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function nowISO(): string {
  return new Date().toISOString();
}

/**
 * 从 auth-store 动态获取当前已登录用户 ID。
 * 使用延迟 require 避免模块初始化阶段的循环依赖。
 * 未登录时返回 null。
 */
function getCurrentUserId(): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('./auth-store');
    return useAuthStore.getState()?.user?.id ?? null;
  } catch {
    return null;
  }
}

// ────────────────────────── DB Connection ─────────────────────

const DB_NAME = 'mahjong_scorer';

let _sqlite: SQLiteConnection | null = null;
let _db: SQLiteDBConnection | null = null;

async function getDb(): Promise<SQLiteDBConnection> {
  if (_db) return _db;

  _sqlite = new SQLiteConnection(CapacitorSQLite);
  const ret = await _sqlite.checkConnectionsConsistency();
  const isConn = (await _sqlite.isConnection(DB_NAME, false)).result;

  if (ret.result && isConn) {
    _db = await _sqlite.retrieveConnection(DB_NAME, false);
  } else {
    _db = await _sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false);
  }

  await _db.open();
  await createTables(_db);
  return _db;
}

async function createTables(db: SQLiteDBConnection): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS saved_members (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar_seed TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS saved_rooms (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      name TEXT NOT NULL,
      rules TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (room_id, member_id),
      FOREIGN KEY (room_id) REFERENCES saved_rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES saved_members(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS completed_sessions (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      saved_room_id TEXT,
      room_name TEXT NOT NULL DEFAULT '',
      played_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS session_players (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      avatar_seed TEXT NOT NULL DEFAULT '',
      saved_member_id TEXT,
      seat_index INTEGER,
      UNIQUE (session_id, player_id),
      FOREIGN KEY (session_id) REFERENCES completed_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (saved_member_id) REFERENCES saved_members(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS session_rounds (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      round_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      UNIQUE (session_id, round_number),
      FOREIGN KEY (session_id) REFERENCES completed_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS round_player_results (
      id TEXT PRIMARY KEY,
      round_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      wind TEXT NOT NULL,
      raw_score INTEGER NOT NULL,
      rank INTEGER NOT NULL,
      pt REAL NOT NULL,
      UNIQUE (round_id, player_id),
      FOREIGN KEY (round_id) REFERENCES session_rounds(id) ON DELETE CASCADE
    );
  `);
  
  // Upgrade schema if needed (for existing installs)
  try { await db.execute("ALTER TABLE saved_members ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));"); } catch {}
  try { await db.execute("ALTER TABLE saved_members ADD COLUMN deleted_at TEXT;"); } catch {}
  try { await db.execute("ALTER TABLE saved_rooms ADD COLUMN deleted_at TEXT;"); } catch {}
  
  // Drop legacy JSONB columns if they still exist (migration from old schema)
  try { await db.execute("ALTER TABLE completed_sessions DROP COLUMN rounds;"); } catch {}
  try { await db.execute("ALTER TABLE completed_sessions DROP COLUMN players;"); } catch {}
  
  // Enable foreign keys
  await db.execute(`PRAGMA foreign_keys = ON;`);
}

// ────────────────────────── Members ───────────────────────────

class LocalMemberRepository implements IMemberRepository {
  async list(deviceId: string): Promise<DbSavedMember[]> {
    const db = await getDb();
    const res = await db.query(
      `SELECT * FROM saved_members WHERE device_id = ? AND deleted_at IS NULL AND avatar_seed != '__DELETED__' ORDER BY created_at DESC`,
      [deviceId]
    );
    return res.values ?? [];
  }

  async upsert(member: Omit<DbSavedMember, 'created_at'>): Promise<DbSavedMember> {
    const db = await getDb();
    const now = nowISO();
    await db.run(
      `INSERT INTO saved_members (id, device_id, name, avatar_seed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar_seed = excluded.avatar_seed, updated_at = excluded.updated_at`,
      [member.id, member.device_id, member.name, member.avatar_seed, now, now]
    );
    const res = await db.query(`SELECT * FROM saved_members WHERE id = ?`, [member.id]);
    return (res.values ?? [])[0];
  }

  async delete(id: string): Promise<void> {
    const db = await getDb();
    const now = nowISO();
    await db.run(
      `UPDATE saved_members SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, id]
    );
  }
}

// ────────────────────────── Room Members ──────────────────────

class LocalRoomMemberRepository implements IRoomMemberRepository {
  async listByRoom(roomId: string): Promise<DbSavedMember[]> {
    const db = await getDb();
    const res = await db.query(
      `SELECT sm.* FROM room_members rm
       JOIN saved_members sm ON sm.id = rm.member_id
       WHERE rm.room_id = ?
       ORDER BY rm.sort_order ASC`,
      [roomId]
    );
    return res.values ?? [];
  }

  async set(roomId: string, memberIds: string[]): Promise<void> {
    const db = await getDb();
    await db.run(`DELETE FROM room_members WHERE room_id = ?`, [roomId]);

    for (let i = 0; i < memberIds.length; i++) {
      await db.run(
        `INSERT INTO room_members (room_id, member_id, sort_order) VALUES (?, ?, ?)`,
        [roomId, memberIds[i], i]
      );
    }
  }
}

// ────────────────────────── Rooms ─────────────────────────────

class LocalRoomRepository implements IRoomRepository {
  private roomMembers = new LocalRoomMemberRepository();

  async list(deviceId: string): Promise<DbSavedRoom[]> {
    const db = await getDb();
    const res = await db.query(
      `SELECT * FROM saved_rooms WHERE device_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC`,
      [deviceId]
    );
    const rooms: DbSavedRoom[] = [];
    for (const row of res.values ?? []) {
      const members = await this.roomMembers.listByRoom(row.id);
      rooms.push({
        ...row,
        rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules,
        members,
      });
    }
    return rooms;
  }

  async get(id: string): Promise<DbSavedRoom | null> {
    const db = await getDb();
    const res = await db.query(`SELECT * FROM saved_rooms WHERE id = ?`, [id]);
    const row = (res.values ?? [])[0];
    if (!row) return null;
    const members = await this.roomMembers.listByRoom(id);
    return {
      ...row,
      rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules,
      members,
    };
  }

  async insert(
    deviceId: string,
    name: string,
    rules: RuleConfig,
    memberIds: string[]
  ): Promise<DbSavedRoom> {
    const db = await getDb();
    const id = uuid();
    const now = nowISO();
    const userId = getCurrentUserId();
    await db.run(
      `INSERT INTO saved_rooms (id, device_id, name, rules, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, deviceId, name, JSON.stringify(rules), now, now]
    );
    await this.roomMembers.set(id, memberIds);
    return { id, device_id: deviceId, name, rules, created_at: now, updated_at: now, members: [] };
  }

  async update(
    id: string,
    patch: Partial<{ name: string; rules: RuleConfig }>
  ): Promise<void> {
    const db = await getDb();
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (patch.name !== undefined) {
      sets.push('name = ?');
      vals.push(patch.name);
    }
    if (patch.rules !== undefined) {
      sets.push('rules = ?');
      vals.push(JSON.stringify(patch.rules));
    }
    if (sets.length === 0) return;

    sets.push("updated_at = datetime('now')");
    vals.push(id);
    await db.run(`UPDATE saved_rooms SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async delete(id: string): Promise<void> {
    const db = await getDb();
    const now = nowISO();
    await db.run(`UPDATE saved_rooms SET deleted_at = ?, updated_at = ? WHERE id = ?`, [now, now, id]);
  }
}

// ────────────────────────── Sessions ──────────────────────────

class LocalSessionRepository implements ISessionRepository {
  async list(deviceId: string, savedRoomId?: string): Promise<DbCompletedSession[]> {
    const db = await getDb();
    let sql = `SELECT * FROM completed_sessions WHERE device_id = ?`;
    const params: unknown[] = [deviceId];

    if (savedRoomId) {
      sql += ` AND saved_room_id = ?`;
      params.push(savedRoomId);
    }
    sql += ` ORDER BY played_at DESC`;

    const res = await db.query(sql, params);
    const sessions: DbCompletedSession[] = [];

    for (const row of res.values ?? []) {
      // Fetch session players
      const playersRes = await db.query(
        `SELECT * FROM session_players WHERE session_id = ? ORDER BY seat_index ASC`,
        [row.id]
      );

      // Fetch session rounds
      const roundsRes = await db.query(
        `SELECT * FROM session_rounds WHERE session_id = ? ORDER BY round_number ASC`,
        [row.id]
      );

      const sessionRounds: DbSessionRound[] = [];
      for (const rd of roundsRes.values ?? []) {
        const resultsRes = await db.query(
          `SELECT * FROM round_player_results WHERE round_id = ? ORDER BY rank ASC`,
          [rd.id]
        );
        sessionRounds.push({
          ...rd,
          start_time: Number(rd.start_time),
          end_time: rd.end_time ? Number(rd.end_time) : undefined,
          results: (resultsRes.values ?? []).map((r) => ({
            ...r,
            pt: Number(r.pt),
          })),
        });
      }

      sessions.push({
        ...row,
        sessionRounds,
        sessionPlayers: playersRes.values ?? [],
      });
    }

    return sessions;
  }

  async insert(
    session: Omit<DbCompletedSession, 'id' | 'played_at'>
  ): Promise<DbCompletedSession> {
    const db = await getDb();
    const id = uuid();
    const now = nowISO();
    const userId = getCurrentUserId();

    // 1. Insert session base row
    await db.run(
      `INSERT INTO completed_sessions (id, device_id, saved_room_id, room_name, played_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, session.device_id, session.saved_room_id ?? null, session.room_name, now]
    );

    // 2. Insert session players
    if (session.sessionPlayers && session.sessionPlayers.length > 0) {
      for (let i = 0; i < session.sessionPlayers.length; i++) {
        const p = session.sessionPlayers[i];
        await db.run(
          `INSERT INTO session_players (id, session_id, player_id, player_name, avatar_seed, saved_member_id, seat_index)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuid(), id, p.player_id, p.player_name, p.avatar_seed, p.saved_member_id || null, p.seat_index ?? i]
        );
      }
    }

    // 3. Insert session rounds + round player results
    if (session.sessionRounds && session.sessionRounds.length > 0) {
      for (const round of session.sessionRounds) {
        const roundId = uuid();
        await db.run(
          `INSERT INTO session_rounds (id, session_id, round_number, status, start_time, end_time)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [roundId, id, round.round_number, round.status, round.start_time, round.end_time ?? null]
        );

        if (round.results && round.results.length > 0) {
          for (const r of round.results) {
            await db.run(
              `INSERT INTO round_player_results (id, round_id, player_id, player_name, wind, raw_score, rank, pt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [uuid(), roundId, r.player_id, r.player_name, r.wind, r.raw_score, r.rank, r.pt]
            );
          }
        }
      }
    }

    return {
      id,
      device_id: session.device_id,
      saved_room_id: session.saved_room_id,
      room_name: session.room_name,
      played_at: now,
      sessionRounds: session.sessionRounds,
      sessionPlayers: session.sessionPlayers,
    };
  }

  async update(
    id: string,
    updates: Partial<Omit<DbCompletedSession, 'id' | 'device_id' | 'played_at'>>
  ): Promise<void> {
    const db = await getDb();

    // Update base fields
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (updates.saved_room_id !== undefined) {
      sets.push('saved_room_id = ?');
      vals.push(updates.saved_room_id);
    }
    if (updates.room_name !== undefined) {
      sets.push('room_name = ?');
      vals.push(updates.room_name);
    }

    if (sets.length > 0) {
      vals.push(id);
      await db.run(`UPDATE completed_sessions SET ${sets.join(', ')} WHERE id = ?`, vals);
    }

    // Replace session players if provided
    if (updates.sessionPlayers !== undefined) {
      await db.run(`DELETE FROM session_players WHERE session_id = ?`, [id]);
      for (let i = 0; i < updates.sessionPlayers.length; i++) {
        const p = updates.sessionPlayers[i];
        await db.run(
          `INSERT INTO session_players (id, session_id, player_id, player_name, avatar_seed, saved_member_id, seat_index)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuid(), id, p.player_id, p.player_name, p.avatar_seed, p.saved_member_id || null, p.seat_index ?? i]
        );
      }
    }

    // Replace session rounds if provided
    if (updates.sessionRounds !== undefined) {
      // Delete old rounds (cascade deletes round_player_results)
      await db.run(`DELETE FROM session_rounds WHERE session_id = ?`, [id]);

      for (const round of updates.sessionRounds) {
        const roundId = uuid();
        await db.run(
          `INSERT INTO session_rounds (id, session_id, round_number, status, start_time, end_time)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [roundId, id, round.round_number, round.status, round.start_time, round.end_time ?? null]
        );

        if (round.results && round.results.length > 0) {
          for (const r of round.results) {
            await db.run(
              `INSERT INTO round_player_results (id, round_id, player_id, player_name, wind, raw_score, rank, pt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [uuid(), roundId, r.player_id, r.player_name, r.wind, r.raw_score, r.rank, r.pt]
            );
          }
        }
      }
    }
  }

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.run(`DELETE FROM completed_sessions WHERE id = ?`, [id]);
  }
}

// ────────────────────────── Composite ─────────────────────────

export class LocalRepository implements IRepository {
  members = new LocalMemberRepository();
  rooms = new LocalRoomRepository();
  roomMembers = new LocalRoomMemberRepository();
  sessions = new LocalSessionRepository();

  /**
   * 确保数据库连接和表已初始化。
   * 首次调用 getDb() 时会自动执行，但也可以显式调用。
   */
  async initialize(): Promise<void> {
    await getDb();
  }

  async exportAllMembers(): Promise<DbSavedMember[]> {
    const db = await getDb();
    const res = await db.query(`SELECT * FROM saved_members ORDER BY created_at ASC`);
    return res.values ?? [];
  }

  async exportAllRooms(): Promise<DbSavedRoom[]> {
    const db = await getDb();
    const res = await db.query(`SELECT * FROM saved_rooms ORDER BY created_at ASC`);
    const rooms: DbSavedRoom[] = [];
    for (const row of res.values ?? []) {
      const members = await this.roomMembers.listByRoom(row.id);
      rooms.push({
        ...row,
        rules: typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules,
        members,
      });
    }
    return rooms;
  }

  async exportAllSessions(): Promise<DbCompletedSession[]> {
    const db = await getDb();
    const res = await db.query(`SELECT * FROM completed_sessions ORDER BY played_at ASC`);
    const sessions: DbCompletedSession[] = [];
    
    for (const row of res.values ?? []) {
      const playersRes = await db.query(
        `SELECT * FROM session_players WHERE session_id = ? ORDER BY seat_index ASC`,
        [row.id]
      );

      const roundsRes = await db.query(
        `SELECT * FROM session_rounds WHERE session_id = ? ORDER BY round_number ASC`,
        [row.id]
      );

      const sessionRounds: DbSessionRound[] = [];
      for (const rd of roundsRes.values ?? []) {
        const resultsRes = await db.query(
          `SELECT * FROM round_player_results WHERE round_id = ? ORDER BY rank ASC`,
          [rd.id]
        );
        sessionRounds.push({
          ...rd,
          start_time: Number(rd.start_time),
          end_time: rd.end_time ? Number(rd.end_time) : undefined,
          results: (resultsRes.values ?? []).map((r) => ({
            ...r,
            pt: Number(r.pt),
          })),
        });
      }

      sessions.push({
        ...row,
        sessionRounds,
        sessionPlayers: playersRes.values ?? [],
      });
    }

    return sessions;
  }
}
