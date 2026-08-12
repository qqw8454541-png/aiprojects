'use client';

import { useEffect, useRef, useState } from 'react';
import { useGameStore, getOrCreateDeviceId } from '@/lib/store';
import { useAuthStore } from '@/lib/auth-store';
import { supabase, onSessionRecovered } from '@/lib/supabase';
import { getPlatformType } from '@/lib/repo-factory';
import { syncEngine, onSyncStateChange } from '@/lib/sync-engine';
import { useI18n } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudFog } from 'lucide-react';

// Helper to omit functions, transient UI state, and viewingRoundId that shouldn't override other clients
const getDbState = (state: ReturnType<typeof useGameStore.getState>) => {
  const { 
    roomCode, roomName, rules, players, seats, rounds, 
  } = state;
  return {
    roomCode,
    roomName,
    rules,
    players,
    seats,
    rounds,
  };
};

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const isUpdatingFromDb = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { t } = useI18n();
  
  useEffect(() => {
    // Ensure deviceId is populated in the store on the client side
    const state = useGameStore.getState();
    if (!state.deviceId) {
      useGameStore.setState({ deviceId: getOrCreateDeviceId() });
    }

    // Initialize Auth Store (loads tier, registers device, sets up session listeners)
    useAuthStore.getState().initialize();
  }, []);

  // ── Sync state listener (works for both native and web) ────
  useEffect(() => {
    const unsub = onSyncStateChange((syncing) => {
      setIsSyncing(syncing);
    });
    return () => { unsub(); };
  }, []);

  // ── Native platform: periodic sync lifecycle ───────────────
  useEffect(() => {
    if (getPlatformType() !== 'native') return;

    // 监听 auth 状态变化来启动/停止定期同步
    const unsub = useAuthStore.subscribe((state, prevState) => {
      const wasProLoggedIn = prevState.isLoggedIn && prevState.isPro;
      const isProLoggedIn = state.isLoggedIn && state.isPro;

      if (!wasProLoggedIn && isProLoggedIn) {
        // 刚登录且是 Pro → 启动定期同步
        syncEngine.startPeriodicSync();
      } else if (wasProLoggedIn && !isProLoggedIn) {
        // 登出或降级 → 停止定期同步
        syncEngine.stopPeriodicSync();
      }
    });

    // 检查当前状态，如果已经是 Pro 登录状态则立即启动
    const { isLoggedIn, isPro } = useAuthStore.getState();
    if (isLoggedIn && isPro) {
      syncEngine.startPeriodicSync();
    }

    return () => {
      unsub();
      syncEngine.stopPeriodicSync();
    };
  }, []);

  // ── Web platform: Zustand → Supabase rooms sync ────────────
  useEffect(() => {
    // Native platforms use local SQLite — skip cloud sync
    if (getPlatformType() === 'native') return;

    // 1. Subscribe to the Zustand store changes to push to DB
    const unsubscribeStore = useGameStore.subscribe(async (state, prevState) => {
      // Don't push to DB if the change came from the DB sync itself
      if (isUpdatingFromDb.current) return;
      
      if (!state.roomCode) return; // Not in a room
      
      const prevDbState = JSON.stringify(getDbState(prevState));
      const currentDbState = JSON.stringify(getDbState(state));
      
      // Only upsert to DB if actual core state changed
      if (prevDbState !== currentDbState) {
        // Upsert room state to DB
        await supabase
          .from('rooms')
          .upsert(
            { room_code: state.roomCode, state: JSON.parse(currentDbState) },
            { onConflict: 'room_code' }
          );
      }
    });

    return () => {
      unsubscribeStore();
    };
  }, []);

  // ── Web platform: Supabase Realtime → Zustand ──────────────
  useEffect(() => {
    // Native platforms use local SQLite — skip Realtime subscriptions
    if (getPlatformType() === 'native') return;

    // 2. Subscribe to Supabase Database changes to update Zustand
    let subscription: ReturnType<typeof supabase.channel> | null = null;
    
    // Using a tiny delay after mount to ensure store is hydrated before subscribing
    const initRealtime = setTimeout(() => {
      const currentRoomCode = useGameStore.getState().roomCode;
      
      if (currentRoomCode) {
        subscription = supabase
          .channel('rooms_channel')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'rooms',
              filter: `room_code=eq.${currentRoomCode}`,
            },
            (payload) => {
              const newRecord = payload.new as { room_code: string, state: any } | undefined;
              if (newRecord?.state) {
                // Update local store without triggering an infinite loop back to DB
                isUpdatingFromDb.current = true;
                
                // Get local state and only update core states
                const currentState = useGameStore.getState();
                const dbState = newRecord.state;
                
                // Keep local UI state like currentPage, viewingRoundId
                useGameStore.setState({
                  ...currentState,
                  roomName: dbState.roomName,
                  rules: dbState.rules,
                  players: dbState.players,
                  seats: dbState.seats,
                  rounds: dbState.rounds,
                });
                
                isUpdatingFromDb.current = false;
              }
            }
          )
          .subscribe();
      }
    }, 100);

    // Also handle when roomCode changes locally (e.g. creating/joining new room)
    const unsubscribeRoomCode = useGameStore.subscribe((state, prevState) => {
      if (state.roomCode !== prevState.roomCode) {
        if (subscription) {
          supabase.removeChannel(subscription);
        }
        
        if (state.roomCode) {
          // Sync immediately before subscribing
          supabase.from('rooms').select('state').eq('room_code', state.roomCode).single()
            .then(({ data }) => {
              if (data?.state) {
                 isUpdatingFromDb.current = true;
                 const currentState = useGameStore.getState();
                 useGameStore.setState({...currentState, ...data.state});
                 // Keep current page mostly intact, but if joined existing, setup
                 if (currentState.currentPage === 'landing') {
                   useGameStore.setState({ currentPage: 'room' });
                 }
                 isUpdatingFromDb.current = false;
              }
            });

          subscription = supabase
            .channel('rooms_channel')
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: 'rooms', filter: `room_code=eq.${state.roomCode}` },
              (payload) => {
                const newRecord = payload.new as any;
                if (newRecord?.state) {
                  isUpdatingFromDb.current = true;
                  useGameStore.setState(newRecord.state);
                  isUpdatingFromDb.current = false;
                }
              }
            )
            .subscribe();
        }
      }
    });

    return () => {
      clearTimeout(initRealtime);
      if (subscription) supabase.removeChannel(subscription);
      unsubscribeRoomCode();
    };
  }, []);

  // ── Session 恢复后重连 Realtime Channel ────────────────────
  useEffect(() => {
    if (getPlatformType() === 'native') return;

    const unsubscribe = onSessionRecovered(() => {
      console.info('[SyncProvider] Session recovered — reconnecting Realtime channels');

      // 清理所有死连接
      supabase.removeAllChannels();

      // 重新订阅当前房间
      const currentRoomCode = useGameStore.getState().roomCode;
      if (currentRoomCode) {
        const newSub = supabase
          .channel(`rooms_recovery_${Date.now()}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'rooms',
              filter: `room_code=eq.${currentRoomCode}`,
            },
            (payload) => {
              const newRecord = payload.new as { room_code: string; state: any } | undefined;
              if (newRecord?.state) {
                isUpdatingFromDb.current = true;
                const currentState = useGameStore.getState();
                useGameStore.setState({
                  ...currentState,
                  roomName: newRecord.state.roomName,
                  rules: newRecord.state.rules,
                  players: newRecord.state.players,
                  seats: newRecord.state.seats,
                  rounds: newRecord.state.rounds,
                });
                isUpdatingFromDb.current = false;
              }
            }
          )
          .subscribe();

        // Store reference for future cleanup (overwriting via closure)
        // The next recovery or unmount will clean it up via removeAllChannels
        void newSub;
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <>
      {children}
      {/* Sync Loading Banner — Lightweight non-blocking banner for incremental sync */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed top-[env(safe-area-inset-top,20px)] left-1/2 -translate-x-1/2 z-[100000] flex items-center gap-2 bg-blue-500/95 text-white px-4 py-2 rounded-full shadow-lg shadow-blue-900/20 backdrop-blur-sm pointer-events-none"
          >
            <CloudFog className="w-4 h-4 animate-pulse" />
            <span className="text-xs font-bold tracking-wider">{t('sync.syncingTitle' as any) || 'SYNCING'}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
