'use client';

import { useTheme } from 'next-themes';
import { useI18n } from '@/lib/i18n';
import { useEffect, useState } from 'react';
import { useGameStore } from '@/lib/store';

export default function TopBar() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useI18n();
  const { 
    roomCode, currentPage, rounds, 
    setPage, resetRoom, roomName, setRoomName 
  } = useGameStore();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    setMounted(true);
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial scroll
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const inProgressRound = rounds.find(r => r.status === 'in_progress');
  const displayRoundNum = inProgressRound ? inProgressRound.roundNumber : rounds.length + 1;

  let leftContent = null;
  
  if (currentPage !== 'landing') {
    // Basic back button
    let backAction = () => setPage('landing');
    if (currentPage === 'venue-coming-soon') {
      backAction = () => setPage('landing');
    } else if (currentPage === 'personal-menu') {
      backAction = () => setPage('landing');
    } else if (currentPage === 'manage-rooms') {
      backAction = () => setPage('personal-menu');
    } else if (currentPage === 'room-history') {
      backAction = () => setPage('manage-rooms');
    } else if (currentPage === 'create') {
      backAction = () => setPage('personal-menu');
    } else if (currentPage === 'room') {
      backAction = () => {
        setPage('personal-menu');
      };
    } else if (currentPage === 'score' || currentPage === 'result' || currentPage === 'report') {
      backAction = () => setPage('room');
    }

    const BackButton = (
      <button
        onClick={backAction}
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700/50 shadow-sm transition-colors"
      >
        ←
      </button>
    );

    // Title and Additional Info
    let Title = null;
    let ExtraInfo = null;

    if (currentPage === 'create') {
      Title = <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t('create.title')}</h1>;
    } else if (currentPage === 'room') {
      Title = isEditingName ? (
        <input
          autoFocus
          className="text-lg font-bold bg-transparent border-b-2 border-amber-500 outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 w-32 md:w-48"
          value={tempName}
          onChange={(e) => setTempName(e.target.value)}
          onBlur={() => {
            setIsEditingName(false);
            if (tempName.trim()) setRoomName(tempName.trim());
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setIsEditingName(false);
              if (tempName.trim()) setRoomName(tempName.trim());
            }
          }}
          placeholder={t('room.title')}
        />
      ) : (
        <h1 
          className="text-lg font-bold flex items-center gap-1.5 cursor-pointer text-zinc-900 dark:text-zinc-100 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
          onClick={() => {
            setTempName(roomName || '');
            setIsEditingName(true);
          }}
        >
          {roomName ? roomName : t('room.title')} <span className="opacity-40 text-xs text-amber-500">✏️</span>
        </h1>
      );
      if (roomCode) {
        ExtraInfo = <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">{roomCode.toUpperCase()}</span>;
      }
    } else if (currentPage === 'score') {
      Title = <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[120px] sm:max-w-[200px]">{roomName ? roomName : t('score.title')}</h1>;
      ExtraInfo = <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex-shrink-0">#{displayRoundNum}</span>;
    } else if (currentPage === 'result') {
      Title = <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[120px] sm:max-w-[200px]">{roomName ? roomName : t('result.title')}</h1>;
      ExtraInfo = <span className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex-shrink-0">#{displayRoundNum}</span>;
    } else if (currentPage === 'report') {
      Title = <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[120px] sm:max-w-[200px]">{roomName ? roomName : t('result.reportTitle' as Parameters<typeof t>[0])}</h1>;
    } else if (currentPage === 'personal-menu') {
      Title = <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t('landing.personalMode')}</h1>;
    } else if (currentPage === 'manage-rooms') {
      Title = <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t('manage.title')}</h1>;
    } else if (currentPage === 'room-history') {
      Title = <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t('history.title')}</h1>;
    }

    leftContent = (
      <div className="flex items-center gap-3">
        {BackButton}
        <div className="flex flex-col justify-center overflow-hidden">
          <div className="flex items-center gap-2">
            {Title}
            {ExtraInfo}
          </div>
        </div>
      </div>
    );
  }

  return (
    <header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300
        ${isScrolled 
          ? 'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 shadow-sm py-2 px-4' 
          : 'bg-transparent border-transparent py-4 px-4'}
      `}
    >
      <div className="flex justify-between items-center max-w-lg mx-auto w-full">
        <div className="flex items-center flex-1">
          {leftContent}
        </div>
        
        <div className="flex items-center gap-1">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as 'ja' | 'zh' | 'en')}
            className="appearance-none bg-transparent text-zinc-700 dark:text-zinc-300 text-xs font-medium pl-3 pr-2 py-1.5 rounded-full outline-none cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <option value="ja" className="bg-white dark:bg-zinc-900">🇯🇵 JA</option>
            <option value="zh" className="bg-white dark:bg-zinc-900">🇨🇳 ZH</option>
            <option value="en" className="bg-white dark:bg-zinc-900">🇺🇸 EN</option>
          </select>

          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Toggle theme"
          >
            {mounted ? (theme === 'dark' ? '🌙' : '☀️') : '🌓'}
          </button>
        </div>
      </div>
    </header>
  );
}
