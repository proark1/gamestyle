import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Multi-Platform Haptics Utility
 * Provides touch feedback across mobile browsers, Android, and iOS.
 */

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'selection';

export async function triggerHaptic(
  style: HapticStyle = 'light',
): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      if (style === 'selection') {
        await Haptics.selectionStart();
        await Haptics.selectionChanged();
        return;
      }
      const impactMap: Record<'light' | 'medium' | 'heavy', ImpactStyle> = {
        light: ImpactStyle.Light,
        medium: ImpactStyle.Medium,
        heavy: ImpactStyle.Heavy,
      };
      await Haptics.impact({ style: impactMap[style] });
      return;
    } catch {
      // Ignore native haptic errors on unsupported devices
    }
  }

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function'
  ) {
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
