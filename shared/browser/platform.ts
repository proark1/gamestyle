import { Capacitor } from '@capacitor/core';

export type PlatformType = 'ios' | 'android' | 'web';

/**
 * Returns the current platform ('ios' | 'android' | 'web').
 * Accurately detects native Capacitor runtimes as well as mobile/desktop browsers.
 */
export function getPlatform(): PlatformType {
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') return 'ios';
    if (platform === 'android') return 'android';
  }

  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'web';
  }

  const userAgent = navigator.userAgent || navigator.vendor || '';
  if (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  ) {
    return 'ios';
  }
  if (/android/i.test(userAgent)) {
    return 'android';
  }

  return 'web';
}

/**
 * Returns true if the application is running inside a native Capacitor shell (iOS or Android app).
 */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Returns true if the application is running in standalone app mode
 * (either installed PWA on mobile home screen, or native Capacitor app).
 */
export function isStandalone(): boolean {
  if (isNative()) return true;
  if (typeof window === 'undefined') return false;

  const isStandaloneDisplay = window.matchMedia?.(
    '(display-mode: standalone)',
  )?.matches;
  const isIosStandalone =
    (navigator as unknown as { standalone?: boolean })?.standalone === true;

  return Boolean(isStandaloneDisplay || isIosStandalone);
}

/**
 * Returns true if running on a mobile device or touch-first screen.
 */
export function isMobile(): boolean {
  const platform = getPlatform();
  if (platform === 'ios' || platform === 'android') return true;
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(max-width: 768px)')?.matches || isTouchDevice();
}

/**
 * Returns true if the device supports touch input.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined')
    return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
