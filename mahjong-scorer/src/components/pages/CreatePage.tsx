'use client';
import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';
import type { RuleConfig } from '@/lib/rules';
import RulePresets from '@/components/RulePresets';
import { getRepository } from '@/lib/repo-factory';
import type { DbSavedRoom } from '@/lib/repository';
import { hapticLight } from '@/lib/haptics';
import { Plus, Clock } from 'lucide-react';

export default function CreatePage() {
  const { t } = useI18n();
  const { setPage, createRoom, deviceId } = useGameStore();
  
  const [existingRooms, setExistingRooms] = useState<DbSavedRoom[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<'new' | string>('new');
  
  useEffect(() => {
    async function loadRooms() {
      if (!deviceId) return;
      const repo = await getRepository();
      const rooms = await repo.rooms.list(deviceId);
      setExistingRooms(rooms);
    }
    loadRooms();
  }, [deviceId]);

  function handleRuleSelect(rules: RuleConfig) {
    if (selectedRoomId === 'new') {
      createRoom(rules, { isNewRoom: true, pendingRoomName: 'unnamed' });
    } else {
      createRoom(rules, { savedRoomId: selectedRoomId });
    }
  }

  const selectedRules = selectedRoomId === 'new' 
    ? undefined 
    : existingRooms.find(r => r.id === selectedRoomId)?.rules;

  return (
    <div className="min-h-dvh px-4 py-6 pt-safe-24 page-enter">

      {/* ── Room Selection Section ── */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-3 ml-1">{t('room.roomSelection' as Parameters<typeof t>[0]) || 'Room Selection'}</h2>
        <div className="grid grid-cols-2 gap-3">
          {/* New Room Option */}
          <button
            onClick={() => { hapticLight(); setSelectedRoomId('new'); }}
            className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-2 ${
              selectedRoomId === 'new'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-emerald-200'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              selectedRoomId === 'new' ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
            }`}>
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <div className={`font-bold text-sm ${selectedRoomId === 'new' ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                {t('room.newRoom' as Parameters<typeof t>[0]) || 'New Room'}
              </div>
              <div className="text-[11px] text-zinc-500 mt-1">
                {t('room.newRoomDesc' as Parameters<typeof t>[0]) || 'Start a fresh match'}
              </div>
            </div>
          </button>

          {/* Existing Rooms Option (Dropdown or Latest) */}
          <button
            disabled={existingRooms.length === 0}
            onClick={() => {
              if (existingRooms.length > 0) {
                hapticLight();
                setSelectedRoomId(existingRooms[0].id);
              }
            }}
            className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-2 ${
              selectedRoomId !== 'new'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                : existingRooms.length === 0
                  ? 'border-zinc-100 dark:border-zinc-800/30 bg-zinc-50 dark:bg-zinc-800/20 opacity-50 cursor-not-allowed'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-emerald-200'
            }`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              selectedRoomId !== 'new' ? 'bg-emerald-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
            }`}>
              <Clock className="w-5 h-5" />
            </div>
            <div className="w-full">
              <div className={`font-bold text-sm ${selectedRoomId !== 'new' ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                {t('room.existingRoom' as Parameters<typeof t>[0]) || 'History Room'}
              </div>
              {selectedRoomId !== 'new' ? (
                <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                  <select 
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full text-[11px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg py-1 px-2 text-zinc-700 dark:text-zinc-300"
                  >
                    {existingRooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="text-[11px] text-zinc-500 mt-1">
                  {existingRooms.length === 0 ? (t('room.noHistoryRooms' as Parameters<typeof t>[0]) || 'No rooms') : (t('room.selectHistoryRoom' as Parameters<typeof t>[0]) || 'Select past room')}
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      <RulePresets 
        key={selectedRoomId}
        onSelect={handleRuleSelect} 
        defaultRules={selectedRules} 
      />
    </div>
  );
}
