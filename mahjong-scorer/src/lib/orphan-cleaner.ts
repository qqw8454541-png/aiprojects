import { getRepository } from './repo-factory';

/**
 * 孤儿数据清扫机制
 * 清理因为意外中断（如App被系统杀死）导致的无主 session 数据
 * 条件：
 * 1. saved_room_id 为 null (未绑定房间)
 * 2. played_at 距离当前超过 24 小时
 */
export async function cleanOrphanSessions(deviceId: string): Promise<number> {
  if (!deviceId) return 0;
  
  try {
    const repo = await getRepository();
    // 获取设备所有的 session
    const sessions = await repo.sessions.list(deviceId);
    
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    
    let deletedCount = 0;
    
    for (const session of sessions) {
      // 如果没有绑定房间
      if (!session.saved_room_id) {
        const playedAt = new Date(session.played_at).getTime();
        // 且时间超过 24 小时
        if (now - playedAt > ONE_DAY_MS) {
          try {
            await repo.sessions.delete(session.id);
            deletedCount++;
          } catch (e) {
            console.error(`Failed to delete orphan session ${session.id}`, e);
          }
        }
      }
    }
    
    if (deletedCount > 0) {
      console.log(`[OrphanCleaner] Cleaned ${deletedCount} orphan sessions`);
    }
    
    return deletedCount;
  } catch (error) {
    console.error('[OrphanCleaner] Failed to clean orphan sessions', error);
    return 0;
  }
}
