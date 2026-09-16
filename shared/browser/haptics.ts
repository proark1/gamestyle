/**
 * Multi-Platform Haptics Utility
 * Provides touch feedback across mobile browsers, Android, and iOS.
 */

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection';

export function triggerHaptic(style: HapticStyle = 'light'): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return;
  }

  if (typeof navigator.vibrate === 'function') {
    try {
      switch (style) {
        case 'light':
        case 'selection':
          navigator.vibrate(10);
          break;
        case 'medium':
          navigator.vibrate(25);
          break;
        case 'heavy':
          navigator.vibrate([40, 30, 40]);
          break;
      }
    } catch {
      // Vibrate not allowed by permissions policy
    }
  }
}
