'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

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
  
  useEffect(() => {
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

  useEffect(() => {
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

  return <>{children}</>;
}
