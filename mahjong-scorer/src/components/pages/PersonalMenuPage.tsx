'use client';
import { useI18n } from '@/lib/i18n';
import { useGameStore } from '@/lib/store';

export default function PersonalMenuPage() {
  const { t } = useI18n();
  const { setPage, roomCode } = useGameStore();

  const isResuming = !!roomCode;

  const items = [
    ...(isResuming
      ? [
          {
            page: 'room' as const,
            icon: '🎮',
            label: 'room.continueMatch' as any,
            desc: 'personal.newGameDesc' as any,
            color: 'from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600',
            shadow: 'shadow-amber-900/20',
            textColor: 'text-white',
          },
        ]
      : []),
    {
      page: 'create' as const,
      icon: '🎴',
      label: 'personal.newGame' as any,
      desc: 'personal.newGameDesc' as any,
      color: 'from-emerald-500 to-teal-500 dark:from-emerald-600 dark:to-teal-600',
      shadow: 'shadow-emerald-900/20',
      textColor: 'text-white',
    },
    {
      page: 'manage-rooms' as const,
      icon: '⚙️',
      label: 'personal.manageRooms' as any,
      desc: 'personal.manageRoomsDesc' as any,
      color: 'from-zinc-600 to-zinc-700 dark:from-zinc-700 dark:to-zinc-800',
      shadow: 'shadow-zinc-900/20',
      textColor: 'text-white',
    },
  ];

  return (
    <div className="flex flex-col min-h-dvh pt-24 px-5 page-enter">
      <div className="space-y-4">
        {items.map((item) => (
          <button
            key={item.page}
            onClick={() => setPage(item.page)}
            className={`w-full py-5 px-6 rounded-2xl bg-gradient-to-r ${item.color} ${item.textColor}
                       hover:brightness-110 active:scale-[0.98] transition-all shadow-lg ${item.shadow}
                       flex items-center gap-4 text-left`}
          >
            <span className="text-3xl">{item.icon}</span>
            <div>
              <div className="font-bold text-lg leading-tight">{t(item.label)}</div>
              <div className="text-sm opacity-75 mt-0.5">{t(item.desc)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
