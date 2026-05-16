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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS saved_rooms (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      name TEXT NOT NULL,
      rules TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
      rounds TEXT NOT NULL DEFAULT '[]',
      players TEXT NOT NULL DEFAULT '[]',
      played_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  // Enable foreign keys
  await db.execute(`PRAGMA foreign_keys = ON;`);
}

// ────────────────────────── Members ───────────────────────────

class LocalMemberRepository implements IMemberRepository {
  async list(deviceId: string): Promise<DbSavedMember[]> {
    const db = await getDb();
    const res = await db.query(
      `SELECT * FROM saved_members WHERE device_id = ? AND avatar_seed != '__DELETED__' ORDER BY created_at DESC`,
      [deviceId]
    );
    return res.values ?? [];
  }

  async upsert(member: Omit<DbSavedMember, 'created_at'>): Promise<DbSavedMember> {
    const db = await getDb();
    const now = nowISO();
    await db.run(
      `INSERT INTO saved_members (id, device_id, name, avatar_seed, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, avatar_seed = excluded.avatar_seed`,
      [member.id, member.device_id, member.name, member.avatar_seed, now]
    );
    const res = await db.query(`SELECT * FROM saved_members WHERE id = ?`, [member.id]);
    return (res.values ?? [])[0];
  }

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.run(
      `UPDATE saved_members SET avatar_seed = '__DELETED__' WHERE id = ?`,
      [id]
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
      `SELECT * FROM saved_rooms WHERE device_id = ? ORDER BY updated_at DESC`,
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
    // room_members will cascade
    await db.run(`DELETE FROM saved_rooms WHERE id = ?`, [id]);
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
    return (res.values ?? []).map((row) => ({
      ...row,
      rounds: typeof row.rounds === 'string' ? JSON.parse(row.rounds) : row.rounds,
      players: typeof row.players === 'string' ? JSON.parse(row.players) : row.players,
    }));
  }

  async insert(
    session: Omit<DbCompletedSession, 'id' | 'played_at'>
  ): Promise<DbCompletedSession> {
    const db = await getDb();
    const id = uuid();
    const now = nowISO();
    await db.run(
      `INSERT INTO completed_sessions (id, device_id, saved_room_id, room_name, rounds, players, played_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        session.device_id,
        session.saved_room_id ?? null,
        session.room_name,
        JSON.stringify(session.rounds),
        JSON.stringify(session.players),
        now,
      ]
    );
    return {
      id,
      device_id: session.device_id,
      saved_room_id: session.saved_room_id,
      room_name: session.room_name,
      rounds: session.rounds,
      players: session.players,
      played_at: now,
    };
  }

  async update(
    id: string,
    updates: Partial<Omit<DbCompletedSession, 'id' | 'device_id' | 'played_at'>>
  ): Promise<void> {
    const db = await getDb();
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
    if (updates.rounds !== undefined) {
      sets.push('rounds = ?');
      vals.push(JSON.stringify(updates.rounds));
    }
    if (updates.players !== undefined) {
      sets.push('players = ?');
      vals.push(JSON.stringify(updates.players));
    }
    if (sets.length === 0) return;

    vals.push(id);
    await db.run(`UPDATE completed_sessions SET ${sets.join(', ')} WHERE id = ?`, vals);
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
}
