import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export * from './wake-lock';
export * from './haptics';

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

/**
 * Initializes native Android and iOS Capacitor integrations:
 * - Automatically hides splash screen once app is mounted.
 * - Configures transparent status bar with dark style matching theme.
 * - Handles Android hardware back button (navigates or exits gracefully).
 * - Handles deep links (jumbleyard://room/ABCDEF or https://... links).
 */
export function initNativeApp(
  options: {
    onBack?: () => boolean;
    onUrlOpen?: (url: string) => void;
  } = {},
): () => void {
  if (!isNative() || typeof window === 'undefined') {
    return () => {};
  }

  const cleanups: (() => void)[] = [];

  // Hide splash screen after boot
  void SplashScreen.hide().catch(() => {});

  // Set dark status bar style overlaying WebView
  void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  void StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});

  // Handle Android back button
  void App.addListener('backButton', (data) => {
    if (options.onBack && options.onBack()) {
      return;
    }
    if (data.canGoBack && window.location.pathname !== '/') {
      window.history.back();
    } else {
      void App.exitApp();
    }
  }).then((handle) => {
    cleanups.push(() => void handle.remove());
  });

  // Handle deep linking (custom scheme or Universal/App Links)
  void App.addListener('appUrlOpen', (event) => {
    if (options.onUrlOpen) {
      options.onUrlOpen(event.url);
      return;
    }
    try {
      const url = new URL(event.url);
      const target = url.pathname + url.search;
      if (
        target &&
        target !== window.location.pathname + window.location.search
      ) {
        window.location.assign(target);
      }
    } catch {
      // Fallback for custom schemes like jumbleyard://stack-or-sink?room=ABCDEF
      const match = event.url.match(/^jumbleyard:\/\/(.*)$/);
      if (match?.[1]) {
        const dest = '/' + match[1];
        window.location.assign(dest);
      }
    }
  }).then((handle) => {
    cleanups.push(() => void handle.remove());
  });

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
