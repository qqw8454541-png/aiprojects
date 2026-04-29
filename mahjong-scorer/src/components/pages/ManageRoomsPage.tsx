'use client';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import Avatar from '@/components/Avatar';
import { safeRandomUUID } from '@/lib/utils';

export default function ManageRoomsPage() {
  const { t } = useI18n();
  const { deviceId, setPage, setViewingHistoryRoomId, loadSavedRoom } = useGameStore();
  const [rooms, setRooms] = useState<import('@/lib/db').DbSavedRoom[]>([]);
  const [members, setMembers] = useState<import('@/lib/db').DbSavedMember[]>([]);
  const [activeTab, setActiveTab] = useState<'rooms' | 'members'>('rooms');
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editingMember, setEditingMember] = useState<import('@/lib/db').DbSavedMember | null>(null);
  const [editMemberName, setEditMemberName] = useState('');
  const [editMemberAvatar, setEditMemberAvatar] = useState('');

  const reload = async () => {
    if (!deviceId) return;
    const { dbRooms, dbMembers } = await import('@/lib/db');
    setRooms(await dbRooms.list(deviceId));
    setMembers(await dbMembers.list(deviceId));
    setLoading(false);
  };

  useEffect(() => {
    reload().catch(err => {
      console.error("Failed to load manage rooms:", err);
      alert("Network Error: Could not connect to database. " + err.message);
      setLoading(false);
    });
  }, [deviceId]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(t('manage.deleteRoomConfirm'))) return;
    const { dbRooms } = await import('@/lib/db');
    await dbRooms.delete(id);
    await reload();
  };

  const handleSaveName = async (id: string) => {
    if (!editName.trim()) return;

    if (rooms.some(r => r.id !== id && r.name.toLowerCase() === editName.trim().toLowerCase())) {
      alert(t('manage.duplicateRoomName' as Parameters<typeof t>[0]) || 'Room name cannot be duplicated!');
      return;
    }

    const { dbRooms } = await import('@/lib/db');
    await dbRooms.update(id, { name: editName.trim() });
    setEditingId(null);
    await reload();
  };

  const handleSaveMember = async () => {
    if (!editingMember || !editMemberName.trim()) return;
    const { dbMembers } = await import('@/lib/db');
    await dbMembers.upsert({
      id: editingMember.id,
      device_id: editingMember.device_id,
      name: editMemberName.trim(),
      avatar_seed: editMemberAvatar,
    });
    setEditingMember(null);
    await reload();
  };

  const handleDeleteMember = async (id: string) => {
    if (!confirm(t('manage.deleteMemberConfirm' as Parameters<typeof t>[0]))) return;
    const { dbMembers } = await import('@/lib/db');
    await dbMembers.delete(id);
    await reload();
  };

  const handleViewHistory = (id: string) => {
    setViewingHistoryRoomId(id);
    setPage('room-history');
  };

  const handleStart = async (roomId: string) => {
    setLoadingId(roomId);
    try {
      await loadSavedRoom(roomId);
    } catch {
      alert('Failed to load room');
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="min-h-dvh pt-24 px-4 pb-8 page-enter">
      {loading ? (
        <div className="flex justify-center py-20 text-zinc-400">Loading...</div>
      ) : (
        <>
          <div className="flex bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-xl mb-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
            <button 
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'rooms' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              onClick={() => setActiveTab('rooms')}
            >
              {t('manage.tabRooms' as Parameters<typeof t>[0])}
            </button>
            <button 
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === 'members' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              onClick={() => setActiveTab('members')}
            >
              {t('manage.tabMembers' as Parameters<typeof t>[0])}
            </button>
          </div>

          {activeTab === 'rooms' && (
            rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <div className="text-5xl">⚙️</div>
                <p className="font-bold text-zinc-700 dark:text-zinc-300">{t('manage.empty')}</p>
              </div>
            ) : (
              <div className="space-y-3">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
                onClick={() => setExpandedId(expandedId === room.id ? null : room.id)}
              >
                <div>
                  {editingId === room.id ? (
                    <input
                      autoFocus
                      className="text-base font-bold bg-transparent border-b border-amber-400 outline-none text-zinc-900 dark:text-zinc-100 w-48"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(room.id); e.stopPropagation(); }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="font-bold text-base text-zinc-900 dark:text-zinc-100">{room.name}</span>
                  )}
                  <div className="text-xs text-zinc-500 mt-0.5">{(room.members ?? []).length} {t('manage.members')}</div>
                </div>
                <span className="text-zinc-400">{expandedId === room.id ? '▲' : '▼'}</span>
              </button>

              {expandedId === room.id && (
                <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800 pt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {(room.members ?? []).map((m) => {
                      const isDeleted = m.avatar_seed === '__DELETED__';
                      return (
                      <div 
                        key={m.id} 
                        onClick={() => {
                          if (isDeleted) return;
                          setEditingMember(m);
                          setEditMemberName(m.name);
                          setEditMemberAvatar(m.avatar_seed);
                        }}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${isDeleted ? 'bg-zinc-100/50 dark:bg-zinc-800/30 cursor-not-allowed opacity-60' : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 cursor-pointer transition-colors'}`}
                      >
                        <Avatar seed={m.avatar_seed} size={20} className={isDeleted ? 'grayscale' : ''} />
                        <span className={`text-sm ${isDeleted ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-700 dark:text-zinc-300'}`}>
                          {m.name} {isDeleted && <span className="text-[10px] no-underline ml-1">(Deleted)</span>} <span className="text-[10px] text-zinc-400 font-mono ml-0.5">#{m.id.substring(0, 4)}</span>
                        </span>
                      </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {editingId === room.id ? (
                      <button onClick={() => handleSaveName(room.id)} className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-bold">{t('manage.saveChanges')}</button>
                    ) : (
                      <button onClick={() => { setEditingId(room.id); setEditName(room.name); }} className="px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium">{t('manage.editName')}</button>
                    )}
                    <button onClick={() => handleViewHistory(room.id)} className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm font-medium border border-blue-200 dark:border-blue-800/50">{t('manage.viewHistory')}</button>
                    <button onClick={() => handleStart(room.id)} disabled={loadingId === room.id} className="px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm font-medium border border-emerald-200 dark:border-emerald-800/50">{loadingId === room.id ? '...' : (t('savedRooms.startGame' as any) || 'Start Game')}</button>
                    <button onClick={() => handleDelete(room.id, room.name)} className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 text-sm font-medium border border-red-200 dark:border-red-800/50">{t('manage.deleteRoom')}</button>
                  </div>
                </div>
              )}
            </div>
          ))}
              </div>
            )
          )}

      {activeTab === 'members' && (
        <div className="space-y-4">
          <button
            onClick={() => {
              if (!deviceId) return;
              const seed = Math.random().toString(36).substring(2, 10);
              setEditingMember({
                id: safeRandomUUID(),
                device_id: deviceId,
                name: '',
                avatar_seed: seed,
                created_at: new Date().toISOString()
              });
              setEditMemberName('');
              setEditMemberAvatar(seed);
            }}
            className="w-full py-4 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-bold hover:border-amber-400 hover:text-amber-500 transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-xl">+</span> {t('manage.newMember' as Parameters<typeof t>[0])}
          </button>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {members.map(m => (
              <div key={m.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <Avatar seed={m.avatar_seed} size={40} />
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-zinc-100 text-base">{m.name}</div>
                    <div className="text-[10px] text-zinc-400 font-mono">#{m.id.substring(0, 8)}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setEditingMember(m);
                      setEditMemberName(m.name);
                      setEditMemberAvatar(m.avatar_seed);
                    }}
                    className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition shadow-sm"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => handleDeleteMember(m.id)}
                    className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 transition shadow-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}

      {/* Edit Member Modal */}
      <AnimatePresence>
        {editingMember && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditingMember(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-xl"
            >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100">{t('room.managePlayer' as Parameters<typeof t>[0])}</h3>
                <button
                  onClick={() => setEditingMember(null)}
                  className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition"
                >
                  ✕
                </button>
              </div>
              <div className="p-6 flex flex-col items-center">
                <div className="relative mb-6 group cursor-pointer" onClick={() => setEditMemberAvatar(Math.random().toString(36).substring(2, 10))}>
                  <Avatar seed={editMemberAvatar} size={96} className="ring-4 ring-amber-100 dark:ring-amber-900/30" />
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-white text-xs font-bold pointer-events-none">{t('room.randomAvatar' as Parameters<typeof t>[0])}</span>
                  </div>
                </div>
                
                <div className="w-full space-y-4">
                  <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase mb-1 block">{t('room.name' as Parameters<typeof t>[0])}</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={editMemberName}
                      onChange={(e) => setEditMemberName(e.target.value)}
                      className="w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  
                  <button
                    onClick={handleSaveMember}
                    className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold transition shadow-sm"
                  >
                    {t('room.save' as Parameters<typeof t>[0])}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
