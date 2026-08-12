import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import type { DbSavedRoom } from '@/lib/repository';
import { getRepository } from '@/lib/repo-factory';
import { useSyncGuard } from '@/lib/use-sync-guard';
import { showToast } from '@/lib/toast-store';

export function MergeRoomsModal({
  rooms,
  deviceId,
  isOpen,
  onClose,
  onSuccess
}: {
  rooms: DbSavedRoom[];
  deviceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [mergeGroups, setMergeGroups] = useState<{
    target: DbSavedRoom,
    targetCount: number,
    sources: {room: DbSavedRoom, count: number, isSubset: boolean}[]
  }[]>([]);
  const { guardedAction } = useSyncGuard();

  useEffect(() => {
    if (!isOpen || !deviceId) return;
    const load = async () => {
      setLoading(true);
      try {
        const repo = await getRepository();
        const sessions = await repo.sessions.list(deviceId);
        
        // Count sessions per room
        const sessionCount = new Map<string, number>();
        for (const s of sessions) {
          if (s.saved_room_id) {
            sessionCount.set(s.saved_room_id, (sessionCount.get(s.saved_room_id) || 0) + 1);
          }
        }

        const groups: {
          target: DbSavedRoom,
          targetCount: number,
          sources: {room: DbSavedRoom, count: number, isSubset: boolean}[]
        }[] = [];

        const processedRoomIds = new Set<string>();

        // Sort rooms by descending session count so we tend to pick the most active as target
        const sortedRooms = [...rooms].sort((a, b) => (sessionCount.get(b.id)||0) - (sessionCount.get(a.id)||0));

        for (let i = 0; i < sortedRooms.length; i++) {
          const targetRoom = sortedRooms[i];
          if (processedRoomIds.has(targetRoom.id)) continue;
          
          const targetMemberSet = new Set((targetRoom.members ?? []).map(m => m.id));
          const sources: {room: DbSavedRoom, count: number, isSubset: boolean}[] = [];

          for (let j = i + 1; j < sortedRooms.length; j++) {
            const sourceRoom = sortedRooms[j];
            if (processedRoomIds.has(sourceRoom.id)) continue;

            const sourceMembers = sourceRoom.members ?? [];
            const isSubset = sourceMembers.every(m => targetMemberSet.has(m.id));
            const isExact = isSubset && sourceMembers.length === targetMemberSet.size;

            // Allow merge if exact match or pure subset (at least 1 member)
            if ((isExact || (isSubset && sourceMembers.length > 0))) {
              sources.push({
                room: sourceRoom,
                count: sessionCount.get(sourceRoom.id) || 0,
                isSubset: !isExact
              });
              processedRoomIds.add(sourceRoom.id);
            }
          }

          if (sources.length > 0) {
            groups.push({
              target: targetRoom,
              targetCount: sessionCount.get(targetRoom.id) || 0,
              sources
            });
            processedRoomIds.add(targetRoom.id);
          }
        }

        setMergeGroups(groups);
      } catch (err) {
        console.error("Failed to detect merge groups", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, deviceId, rooms]);

  const handleMerge = () => {
    guardedAction(async () => {
      if (!confirm(t('manage.mergeWarning' as Parameters<typeof t>[0]))) return;
      setLoading(true);
      try {
        const repo = await getRepository();
        for (const group of mergeGroups) {
          const sourceIds = group.sources.map(s => s.room.id);
          await repo.rooms.mergeRooms(group.target.id, sourceIds);
        }
        showToast(t('manage.mergeSuccess' as Parameters<typeof t>[0]), 'success');
        onSuccess();
        onClose();
      } catch (err: any) {
        showToast("Merge failed: " + (err as any).message, 'error');
      } finally {
        setLoading(false);
      }
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] glass-overlay flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-md max-h-[80vh] flex flex-col shadow-xl overflow-hidden"
          >
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{t('manage.mergeTitle' as Parameters<typeof t>[0])}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition">✕</button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {loading ? (
                <div className="py-10 text-center text-zinc-500">Loading...</div>
              ) : mergeGroups.length === 0 ? (
                <div className="py-10 text-center text-zinc-500 font-bold">{t('manage.mergeNoTargets' as Parameters<typeof t>[0])}</div>
              ) : (
                <div className="space-y-6">
                  {mergeGroups.map((g, idx) => (
                    <div key={idx} className="bg-zinc-50 dark:bg-zinc-800/30 rounded-xl p-3 border border-zinc-200 dark:border-zinc-700/50">
                      <div className="font-bold text-zinc-800 dark:text-zinc-200 mb-2 pb-2 border-b border-zinc-200 dark:border-zinc-700 flex justify-between">
                        <span>{t('manage.mergeGroup' as Parameters<typeof t>[0])} {idx + 1}</span>
                      </div>
                      <div className="space-y-3">
                        {/* Target */}
                        <div className="flex items-center justify-between text-sm bg-emerald-50 dark:bg-emerald-900/10 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                          <div>
                            <div className="font-bold text-emerald-700 dark:text-emerald-400">
                              <span className="text-[10px] uppercase bg-emerald-200 dark:bg-emerald-800 px-1.5 py-0.5 rounded mr-1 text-emerald-800 dark:text-emerald-100">{t('manage.mergeRoomTarget' as Parameters<typeof t>[0])}</span>
                              {g.target.name}
                            </div>
                            <div className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-1">
                              {(g.target.members ?? []).map(m => m.name).join(', ')}
                            </div>
                          </div>
                          <div className="text-right text-emerald-600 dark:text-emerald-400 font-medium whitespace-nowrap ml-2">
                            {t('manage.mergeSessions' as Parameters<typeof t>[0]).replace('{n}', g.targetCount.toString())}
                          </div>
                        </div>

                        {/* Sources */}
                        {g.sources.map(s => (
                          <div key={s.room.id} className="flex items-center justify-between text-sm bg-amber-50 dark:bg-amber-900/10 p-2 rounded-lg border border-amber-100 dark:border-amber-900/30 ml-4 relative">
                            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-2 h-px bg-zinc-300 dark:bg-zinc-600"></div>
                            <div className="absolute -left-3 -top-3 w-px h-[calc(50%+12px)] bg-zinc-300 dark:bg-zinc-600"></div>
                            
                            <div>
                              <div className="font-bold text-amber-700 dark:text-amber-400">
                                <span className="text-[10px] uppercase bg-amber-200 dark:bg-amber-800 px-1.5 py-0.5 rounded mr-1 text-amber-800 dark:text-amber-100">{t('manage.mergeRoomSource' as Parameters<typeof t>[0])}</span>
                                {s.room.name}
                                {s.isSubset && <span className="text-[10px] bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded ml-1">{t('manage.mergeSubset' as Parameters<typeof t>[0])}</span>}
                              </div>
                              <div className="text-xs text-amber-600/70 dark:text-amber-400/70 mt-1">
                                {(s.room.members ?? []).map(m => m.name).join(', ')}
                              </div>
                            </div>
                            <div className="text-right text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap ml-2">
                              {t('manage.mergeSessions' as Parameters<typeof t>[0]).replace('{n}', s.count.toString())}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {mergeGroups.length > 0 && !loading && (
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
                <button
                  onClick={handleMerge}
                  className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold transition shadow-sm"
                >
                  {t('manage.mergeConfirm' as Parameters<typeof t>[0])}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
