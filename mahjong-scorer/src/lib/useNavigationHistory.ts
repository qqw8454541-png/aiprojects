'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useGameStore, type AppPage } from './store';

/**
 * Back-navigation map — mirrors TopBar.tsx logic exactly.
 * Maps each page to its "parent" page.
 */
const BACK_MAP: Partial<Record<AppPage, AppPage>> = {
  'venue-coming-soon': 'landing',
  'personal-menu': 'landing',
  'manage-rooms': 'personal-menu',
  'room-history': 'manage-rooms',
  'create': 'personal-menu',
  'room': 'personal-menu',
  'score': 'room',
  'result': 'room',
  'report': 'room',
};

/**
 * Maintains a navigation history stack for back/forward swipe support.
 * Returns `canGoBack`, `canGoForward`, `goBack`, `goForward`.
 */
export function useNavigationHistory() {
  const currentPage = useGameStore((s) => s.currentPage);
  const setPage = useGameStore((s) => s.setPage);

  // History stacks
  const historyStack = useRef<AppPage[]>([]);
  const forwardStack = useRef<AppPage[]>([]);
  // Flag to suppress recording when we ourselves trigger a page change
  const isNavigating = useRef(false);

  // Track page changes pushed by other code (buttons, etc.)
  useEffect(() => {
    if (isNavigating.current) {
      isNavigating.current = false;
      return;
    }

    const stack = historyStack.current;
    const prev = stack[stack.length - 1];

    // Only push if it's a genuinely new page (not a duplicate)
    if (prev !== currentPage) {
      stack.push(currentPage);
      // When user navigates normally, clear the forward stack
      forwardStack.current = [];
    }
  }, [currentPage]);

  const canGoBack = currentPage !== 'landing';

  const canGoForward = forwardStack.current.length > 0;

  const goBack = useCallback(() => {
    const stack = historyStack.current;
    const fwd = forwardStack.current;

    if (stack.length > 1) {
      // Pop current page and push it to forward stack
      const current = stack.pop()!;
      fwd.push(current);
      // Navigate to the previous page in the stack
      const target = stack[stack.length - 1];
      isNavigating.current = true;
      setPage(target);
    } else {
      // Fallback: use the static back-map (same as TopBar)
      const target = BACK_MAP[currentPage] ?? 'landing';
      isNavigating.current = true;
      fwd.push(currentPage);
      historyStack.current = [target];
      setPage(target);
    }
  }, [currentPage, setPage]);

  const goForward = useCallback(() => {
    const fwd = forwardStack.current;
    if (fwd.length === 0) return;

    const target = fwd.pop()!;
    isNavigating.current = true;
    historyStack.current.push(target);
    setPage(target);
  }, [setPage]);

  return { canGoBack, canGoForward, goBack, goForward };
}
