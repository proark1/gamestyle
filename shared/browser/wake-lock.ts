import { useEffect } from 'react';

/**
 * Screen Wake Lock Utility
 * Keeps the device screen awake during active gameplay.
 * Gracefully no-ops in environments where Wake Lock API is unavailable.
 */

type WakeLockSentinel = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

let activeSentinel: WakeLockSentinel | null = null;

export async function requestWakeLock(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const nav = navigator as unknown as {
    wakeLock?: { request: (type: string) => Promise<WakeLockSentinel> };
  };
  if (!nav.wakeLock?.request) {
    return false;
  }

  try {
    if (activeSentinel && !activeSentinel.released) {
      return true;
    }
    const sentinel = await nav.wakeLock.request('screen');
    activeSentinel = sentinel;
    sentinel.addEventListener('release', () => {
      if (activeSentinel === sentinel) {
        activeSentinel = null;
      }
    });
    return true;
  } catch {
    // Browser denied wake lock or visibility hidden
    return false;
  }
}

export async function releaseWakeLock(): Promise<void> {
  if (activeSentinel && !activeSentinel.released) {
    try {
      await activeSentinel.release();
    } catch {
      // Ignored
    } finally {
      activeSentinel = null;
    }
  }
}

/**
 * React hook to automatically keep screen awake while a component (e.g. GameToolbar) is mounted.
 */
export function useWakeLock(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    void requestWakeLock();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      void releaseWakeLock();
    };
  }, [enabled]);
}
