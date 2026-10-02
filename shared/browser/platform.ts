import { inviteTarget } from './invite-url';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { isTouchDevice } from './device';

export * from './device';
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
 *
 * Native builds are mobile by definition; on the web this is the same
 * `TOUCH_QUERY` the scenes use, so the HUD, the touch controls and the render
 * tier can never disagree about the device.
 */
export function isMobile(): boolean {
  const platform = getPlatform();
  if (platform === 'ios' || platform === 'android') return true;
  return isTouchDevice();
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
  let disposed = false;
  const keep = (handle: { remove: () => Promise<void> }) => {
    if (disposed) void handle.remove();
    else cleanups.push(() => void handle.remove());
  };
  void App.getLaunchUrl()
    .then((event) => {
      if (disposed || !event) return;
      const target = inviteTarget(event.url);
      if (
        target &&
        target !== window.location.pathname + window.location.search
      )
        window.location.assign(target);
    })
    .catch(() => {});
  void App.addListener('appStateChange', ({ isActive }) => {
    window.dispatchEvent(
      new CustomEvent('game:app-state', { detail: { active: isActive } }),
    );
    if (!isActive) window.dispatchEvent(new Event('blur'));
  }).then(keep);

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
  }).then(keep);

  // Handle deep linking (custom scheme or Universal/App Links)
  void App.addListener('appUrlOpen', (event) => {
    if (options.onUrlOpen) {
      options.onUrlOpen(event.url);
      return;
    }
    const target = inviteTarget(event.url);
    if (target && target !== window.location.pathname + window.location.search)
      window.location.assign(target);
  }).then(keep);

  return () => {
    disposed = true;
    for (const cleanup of cleanups) cleanup();
  };
}
