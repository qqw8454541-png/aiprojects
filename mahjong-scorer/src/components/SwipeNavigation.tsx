'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useNavigationHistory } from '@/lib/useNavigationHistory';
import { useGameStore } from '@/lib/store';
import { hapticHeavy } from '@/lib/haptics';

/** Minimum swipe distance (px) to trigger navigation */
const SWIPE_THRESHOLD = 80;
/** Max vertical drift (px) — ensures it's a horizontal swipe, not a scroll */
const VERTICAL_TOLERANCE = 60;
/** Max swipe duration (ms) */
const MAX_DURATION = 400;

/**
 * SwipeNavigation — invisible overlay component that detects horizontal
 * swipe gestures for mobile back/forward navigation.
 *
 * - Right swipe (→) = go back
 * - Left swipe  (←) = go forward
 *
 * Only active on touch devices. Does NOT interfere with vertical scrolling,
 * input elements, or other interactive content.
 */
export default function SwipeNavigation() {
  const { canGoBack, canGoForward, goBack, goForward } = useNavigationHistory();
  const currentPage = useGameStore((s) => s.currentPage);

  // Touch tracking refs
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);
  const isSwiping = useRef(false);

  // Visual feedback element
  const indicatorRef = useRef<HTMLDivElement>(null);
  const edgeRef = useRef<'left' | 'right' | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    // Don't intercept touches on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest('input, textarea, select, button, a, [role="button"], [data-no-swipe]') ||
      target.closest('.numpad, .score-input')
    ) {
      isSwiping.current = false;
      return;
    }

    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
    isSwiping.current = true;

    // Detect edge start for the visual indicator
    const screenW = window.innerWidth;
    if (touch.clientX < 30) {
      edgeRef.current = 'left'; // right-swipe from left edge → back
    } else if (touch.clientX > screenW - 30) {
      edgeRef.current = 'right'; // left-swipe from right edge → forward
    } else {
      edgeRef.current = null;
    }
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isSwiping.current || !indicatorRef.current) return;

    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = Math.abs(touch.clientY - touchStartY.current);

    // If vertical movement exceeds tolerance, abort swipe
    if (dy > VERTICAL_TOLERANCE) {
      isSwiping.current = false;
      indicatorRef.current.style.opacity = '0';
      return;
    }

    // Show visual feedback for edge swipes
    if (edgeRef.current === 'left' && dx > 15 && canGoBack) {
      const progress = Math.min(dx / SWIPE_THRESHOLD, 1);
      const el = indicatorRef.current;
      el.style.opacity = String(progress * 0.7);
      el.style.left = '0';
      el.style.right = 'auto';
      el.style.background = `linear-gradient(to right, rgba(251,191,36,${progress * 0.4}), transparent)`;
      el.style.transform = `scaleX(${progress})`;
    } else if (edgeRef.current === 'right' && dx < -15 && canGoForward) {
      const progress = Math.min(Math.abs(dx) / SWIPE_THRESHOLD, 1);
      const el = indicatorRef.current;
      el.style.opacity = String(progress * 0.7);
      el.style.right = '0';
      el.style.left = 'auto';
      el.style.background = `linear-gradient(to left, rgba(251,191,36,${progress * 0.4}), transparent)`;
      el.style.transform = `scaleX(${progress})`;
    }
  }, [canGoBack, canGoForward]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!isSwiping.current) {
      if (indicatorRef.current) indicatorRef.current.style.opacity = '0';
      return;
    }
    isSwiping.current = false;

    // Reset indicator
    if (indicatorRef.current) {
      indicatorRef.current.style.opacity = '0';
      indicatorRef.current.style.transform = 'scaleX(0)';
    }

    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartX.current;
    const dy = Math.abs(touch.clientY - touchStartY.current);
    const duration = Date.now() - touchStartTime.current;

    // Validate swipe
    if (dy > VERTICAL_TOLERANCE || duration > MAX_DURATION) return;

    if (dx > SWIPE_THRESHOLD && canGoBack) {
      // Right swipe → back
      hapticHeavy();
      goBack();
    } else if (dx < -SWIPE_THRESHOLD && canGoForward) {
      // Left swipe → forward
      hapticHeavy();
      goForward();
    }
  }, [canGoBack, canGoForward, goBack, goForward]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Don't enable on landing page (nowhere to go back)
  if (currentPage === 'landing' && !canGoForward) return null;

  return (
    <div
      ref={indicatorRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        width: '80px',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        transformOrigin: 'left center',
        transition: 'opacity 0.15s ease-out',
      }}
    />
  );
}
