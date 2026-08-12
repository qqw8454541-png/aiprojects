import { useState, useEffect, useCallback } from 'react';
import { onSyncStateChange, syncEngine } from './sync-engine';
import { translate, getSavedLocale } from './i18n';

/**
 * Creates and shows a lightweight toast for sync busy state.
 * Prevents multiple toasts from stacking.
 */
function showSyncToast() {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById('sync-busy-toast');
  if (existing) return;

  const locale = getSavedLocale();
  const message = translate(locale, 'sync.busyToast' as any) || 'Data is syncing, please try again later';

  const toast = document.createElement('div');
  toast.id = 'sync-busy-toast';
  toast.innerText = message;
  toast.style.position = 'fixed';
  toast.style.top = 'env(safe-area-inset-top, 20px)';
  toast.style.left = '50%';
  toast.style.transform = 'translate(-50%, -20px)';
  toast.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
  toast.style.color = '#fff';
  toast.style.padding = '8px 16px';
  toast.style.borderRadius = '20px';
  toast.style.fontSize = '14px';
  toast.style.fontWeight = '500';
  toast.style.zIndex = '100000';
  toast.style.pointerEvents = 'none';
  toast.style.opacity = '0';
  toast.style.transition = 'all 0.3s ease';

  document.body.appendChild(toast);

  // Trigger entrance animation
  requestAnimationFrame(() => {
    toast.style.transform = 'translate(-50%, 20px)';
    toast.style.opacity = '1';
  });

  // Remove after 2 seconds
  setTimeout(() => {
    toast.style.transform = 'translate(-50%, -20px)';
    toast.style.opacity = '0';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 2000);
}

export function useSyncGuard() {
  const [isSyncing, setIsSyncing] = useState(syncEngine.isRunning);

  useEffect(() => {
    const unsub = onSyncStateChange((syncing) => setIsSyncing(syncing));
    return unsub;
  }, []);

  const guardedAction = useCallback(async <T>(action: () => Promise<T> | T): Promise<T | null> => {
    if (syncEngine.isRunning) {
      showSyncToast();
      return null;
    }
    return action();
  }, []);

  return { isSyncing, guardedAction };
}
