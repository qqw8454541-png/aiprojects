'use client';
import { useEffect } from 'react';
import { useGameStore } from '@/lib/store';
import dynamic from 'next/dynamic';

// === Static Imports (LCP and Core UI) ===
import LandingPage from '@/components/pages/LandingPage';
import VenueComingSoonPage from '@/components/pages/VenueComingSoonPage';
import PersonalMenuPage from '@/components/pages/PersonalMenuPage';
import CreatePage from '@/components/pages/CreatePage';

// === Dynamic Imports (Deferred load for performance) ===
const RoomPage = dynamic(() => import('@/components/pages/RoomPage'));
const ScorePage = dynamic(() => import('@/components/pages/ScorePage'));
const ResultPage = dynamic(() => import('@/components/pages/ResultPage'));
const ManageRoomsPage = dynamic(() => import('@/components/pages/ManageRoomsPage'));
const RoomHistoryPage = dynamic(() => import('@/components/pages/RoomHistoryPage'));

// Heavy client-side library (html-to-image) that relies on window
const ReportPage = dynamic(() => import('@/components/pages/ReportPage'), { ssr: false });

export default function Home() {
  const currentPage = useGameStore((s) => s.currentPage);
  const { rounds, rules } = useGameStore();

  // Crash guard on mount
  useEffect(() => {
    useGameStore.setState((state) => {
      if (state.currentPage === 'score') {
        const hasInProgress = state.rounds.some((r) => r.status === 'in_progress');
        if (!hasInProgress) return { currentPage: 'room' };
      }
      if (state.currentPage === 'room' && !state.rules) {
        return { currentPage: 'landing' };
      }
      return {};
    });
  }, []);

  switch (currentPage) {
    case 'landing':       return <LandingPage />;
    case 'venue-coming-soon': return <VenueComingSoonPage />;
    case 'personal-menu': return <PersonalMenuPage />;
    case 'create':        return <CreatePage />;
    case 'room':          return <RoomPage />;
    case 'score':         return <ScorePage />;
    case 'result':        return <ResultPage />;
    case 'report':        return <ReportPage />;
    case 'manage-rooms':  return <ManageRoomsPage />;
    case 'room-history':  return <RoomHistoryPage />;
    default:              return <LandingPage />;
  }
}
