'use client';

import { useI18n } from '@/lib/i18n';
import type { Wind } from '@/lib/scoring';
import type { Player, SeatAssignment } from '@/lib/store';

interface SeatPickerProps {
  seats: SeatAssignment[];
  players: Player[];
  onAssignSeat: (wind: Wind, playerId: string | null) => void;
}

const WIND_EMOJI: Record<Wind, string> = {
  east: '🀀',
  south: '🀁',
  west: '🀂',
  north: '🀃',
};

const WIND_BG: Record<Wind, string> = {
  east: 'from-red-50 to-red-100/50 border-red-200 dark:from-red-900/60 dark:to-red-950/80 dark:border-red-700/50',
  south: 'from-emerald-50 to-emerald-100/50 border-emerald-200 dark:from-emerald-900/60 dark:to-emerald-950/80 dark:border-emerald-700/50',
  west: 'from-blue-50 to-blue-100/50 border-blue-200 dark:from-blue-900/60 dark:to-blue-950/80 dark:border-blue-700/50',
  north: 'from-purple-50 to-purple-100/50 border-purple-200 dark:from-purple-900/60 dark:to-purple-950/80 dark:border-purple-700/50',
};

export default function SeatPicker({
  seats,
  players,
  onAssignSeat,
}: SeatPickerProps) {
  const { t } = useI18n();

  const windKeys: Record<Wind, string> = {
    east: t('room.east'),
    south: t('room.south'),
    west: t('room.west'),
    north: t('room.north'),
  };

  // Get assigned player IDs
  const assignedIds = new Set(seats.filter((s) => s.playerId).map((s) => s.playerId!));

  function getPlayerName(playerId: string | null): string {
    if (!playerId) return '';
    return players.find((p) => p.id === playerId)?.name ?? '';
  }

  function getAvailablePlayers(currentSeatPlayerId: string | null): Player[] {
    return players.filter(
      (p) => !assignedIds.has(p.id) || p.id === currentSeatPlayerId
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {seats.map((seat) => {
        const available = getAvailablePlayers(seat.playerId);
        const playerName = getPlayerName(seat.playerId);

        return (
          <div
            key={seat.wind}
            className={`
              relative rounded-2xl border bg-gradient-to-br p-4
              ${WIND_BG[seat.wind]}
              transition-all hover:scale-[1.02]
            `}
          >
            {/* Wind label */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{WIND_EMOJI[seat.wind]}</span>
              <span className="text-lg font-bold text-zinc-800 dark:text-zinc-200">
                {windKeys[seat.wind]}
              </span>
            </div>

            {/* Player selector */}
            <select
              value={seat.playerId ?? ''}
              onChange={(e) =>
                onAssignSeat(seat.wind, e.target.value || null)
              }
              className="w-full rounded-lg bg-white dark:bg-black/40 border border-zinc-200 dark:border-zinc-600 text-zinc-900 dark:text-white px-3 py-2
                         text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-sm
                         appearance-none cursor-pointer"
            >
              <option value="">{t('room.vacant')}</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Current player badge */}
            {playerName && (
              <div className="mt-2 text-center">
                <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  {playerName}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
