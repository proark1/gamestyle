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
let pendingRequest: Promise<boolean> | null = null;
let generation = 0;
let hookUsers = 0;

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

  if (activeSentinel && !activeSentinel.released) return true;
  if (pendingRequest) return pendingRequest;

  const requestedGeneration = generation;
  const request = (async () => {
    try {
      const sentinel = await nav.wakeLock!.request('screen');
      if (requestedGeneration !== generation) {
        // A game can close before the browser finishes granting its lock.
        await sentinel.release().catch(() => {});
        return false;
      }
      activeSentinel = sentinel;
      sentinel.addEventListener('release', () => {
        if (activeSentinel === sentinel) activeSentinel = null;
      });
      return true;
    } catch {
      // Browser denied wake lock or visibility hidden.
      return false;
    }
  })();
  pendingRequest = request;
  try {
    return await request;
  } finally {
    if (pendingRequest === request) pendingRequest = null;
  }
}

export async function releaseWakeLock(): Promise<void> {
  generation++;
  pendingRequest = null;
  const sentinel = activeSentinel;
  activeSentinel = null;
  if (sentinel && !sentinel.released) {
    try {
      await sentinel.release();
    } catch {
      // Ignored
    }
  }
}

/**
 * React hook to automatically keep screen awake while a component (e.g. GameToolbar) is mounted.
 */
export function useWakeLock(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    hookUsers++;
    void requestWakeLock();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (--hookUsers === 0) void releaseWakeLock();
    };
  }, [enabled]);
}
