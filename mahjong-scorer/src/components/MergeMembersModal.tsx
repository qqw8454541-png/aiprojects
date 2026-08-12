import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import Avatar from '@/components/Avatar';
import type { DbSavedMember } from '@/lib/repository';
import { getRepository } from '@/lib/repo-factory';
import { useSyncGuard } from '@/lib/use-sync-guard';
import { showToast } from '@/lib/toast-store';

export function MergeMembersModal({
  members,
  deviceId,
  isOpen,
  onClose,
  onSuccess
}: {
  members: DbSavedMember[];
  deviceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [mergeGroups, setMergeGroups] = useState<{name: string, members: {member: DbSavedMember, lastPlayed: number}[]}[]>([]);
  const { guardedAction } = useSyncGuard();

  useEffect(() => {
    if (!isOpen || !deviceId) return;
    const load = async () => {
      setLoading(true);
      try {
        // Group by name
        const groups: Record<string, DbSavedMember[]> = {};
        for (const m of members) {
          if (m.avatar_seed === '__DELETED__') continue;
          const name = m.name.trim();
          if (!groups[name]) groups[name] = [];
          groups[name].push(m);
        }
        const duplicateGroups = Object.entries(groups).filter(([_, arr]) => arr.length > 1);
        
        if (duplicateGroups.length === 0) {
          setMergeGroups([]);
          setLoading(false);
          return;
        }

        const repo = await getRepository();
        const sessions = await repo.sessions.list(deviceId);
        
        // Find last played for each member
        const lastPlayedMap = new Map<string, number>();
        for (const s of sessions) {
          const t_num = new Date(s.played_at).getTime();
          for (const p of (s.sessionPlayers ?? [])) {
            const sid = p.saved_member_id;
            if (sid) {
              const current = lastPlayedMap.get(sid) || 0;
              if (t_num > current) lastPlayedMap.set(sid, t_num);
            }
          }
        }

        const processedGroups = duplicateGroups.map(([name, arr]) => {
          const mapped = arr.map(member => ({
            member,
            lastPlayed: lastPlayedMap.get(member.id) || new Date(member.created_at).getTime()
          }));
          mapped.sort((a, b) => b.lastPlayed - a.lastPlayed);
          return { name, members: mapped };
        });

        setMergeGroups(processedGroups);
      } catch (err) {
        console.error("Failed to detect merge groups", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, deviceId, members]);

  const handleMerge = () => {
    guardedAction(async () => {
      if (!confirm(t('manage.mergeWarning' as Parameters<typeof t>[0]))) return;
      setLoading(true);
      try {
        const repo = await getRepository();
        for (const group of mergeGroups) {
          const targetId = group.members[0].member.id;
          const sourceIds = group.members.slice(1).map(m => m.member.id);
          await repo.members.mergeMembers(targetId, sourceIds);
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
                      <div className="font-bold text-zinc-800 dark:text-zinc-200 mb-2 pb-2 border-b border-zinc-200 dark:border-zinc-700">
                        {t('manage.mergeGroup' as Parameters<typeof t>[0])}: {g.name}
                      </div>
                      <div className="space-y-2">
                        {g.members.map((m, i) => (
                          <div key={m.member.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Avatar seed={m.member.avatar_seed} size={24} />
                              <span className="text-zinc-700 dark:text-zinc-300">
                                {m.member.name}
                                <span className="text-xs text-zinc-400 font-mono ml-1">#{m.member.id.substring(0,4)}</span>
                              </span>
                            </div>
                            <div className="text-right flex flex-col">
                              {i === 0 ? (
                                <span className="text-emerald-500 font-bold text-xs">{t('manage.mergeTarget' as Parameters<typeof t>[0])}</span>
                              ) : (
                                <span className="text-amber-500 font-bold text-xs">{t('manage.mergeSource' as Parameters<typeof t>[0])}</span>
                              )}
                              <span className="text-[10px] text-zinc-500">{t('manage.mergeLastPlayed' as Parameters<typeof t>[0])}: {new Date(m.lastPlayed).toLocaleDateString()}</span>
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
