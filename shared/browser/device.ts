/**
 * One answer to "what kind of device is this, and how hard should we render?".
 *
 * Every game used to decide for itself. The collection ended up with six
 * different spellings of the touch test and twelve different pixel-ratio caps,
 * so two games in the same collection could render 2.4x apart in pixel count on
 * the same phone. The queries and the quality tier live here instead, and
 * `shared/rendering/create-renderer.ts` applies them.
 *
 * This module deliberately has no dependencies — scenes import it on their hot
 * path, and it must not pull in the native shell.
 */

/**
 * Touch-first devices. The width clause catches small windows and the phones
 * that report a fine pointer because a stylus or mouse is paired.
 */
export const TOUCH_QUERY = '(pointer: coarse), (max-width: 900px)';

/**
 * Screens with no room for a desktop layout: short windows and small tablets as
 * well as phones. Wider than `TOUCH_QUERY` on purpose — a compact layout is
 * about space, where the touch tier is about the pointer and the GPU.
 */
export const COMPACT_QUERY =
  '(max-width: 1024px), (max-height: 500px), (pointer: coarse)';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Evaluates a media query, answering false where there is no window. */
export function mediaMatches(query: string): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia(query).matches;
  } catch {
    // A browser that rejects the query is treated as not matching.
    return false;
  }
}

export const isTouchDevice = (): boolean => mediaMatches(TOUCH_QUERY);

export const prefersReducedMotion = (): boolean =>
  mediaMatches(REDUCED_MOTION_QUERY);

/** How hard a scene should push this device. */
export type RenderQuality = {
  /** True on a touch-first device, where the budget is tightest. */
  touch: boolean;
  /**
   * The pixel-ratio ceiling. A phone reporting 3x renders nine times the pixels
   * of a 1x display, which no amount of scene tuning can pay for, so the cap
   * matters more than any other single setting.
   */
  pixelRatio: number;
  /** Multisampling costs most exactly where the budget is tightest. */
  antialias: boolean;
  /** Shadow map resolution for a game's main light. */
  shadowMapSize: number;
};

const TOUCH: Omit<RenderQuality, 'pixelRatio'> = {
  touch: true,
  antialias: false,
  shadowMapSize: 1024,
};

const DESKTOP: Omit<RenderQuality, 'pixelRatio'> = {
  touch: false,
  antialias: true,
  shadowMapSize: 2048,
};

/**
 * How much scene a game asks the device to draw. Most games are `standard`.
 * `heavy` is for the scenes that genuinely cannot afford the standard budget —
 * a whole articulated building site rather than an arena — and buys headroom by
 * dropping resolution first, which is cheaper than losing shadows or effects.
 *
 * These two are the only tiers on purpose. The collection previously had twelve
 * different caps with nothing to say which was right.
 */
export type SceneWeight = 'standard' | 'heavy';

/** The ceiling per tier. Raising any of these changes the whole collection. */
export const PIXEL_RATIO_CAP = {
  standard: { touch: 1.3, desktop: 1.8 },
  heavy: { touch: 1.15, desktop: 1.6 },
} as const;

export function renderQuality(
  weight: SceneWeight = 'standard',
  touch: boolean = isTouchDevice(),
  devicePixelRatio: number = typeof window === 'undefined'
    ? 1
    : window.devicePixelRatio || 1,
): RenderQuality {
  const cap = PIXEL_RATIO_CAP[weight][touch ? 'touch' : 'desktop'];
  return {
    ...(touch ? TOUCH : DESKTOP),
    // A device reporting a ratio below 1, or nothing usable, still renders at 1.
    pixelRatio: Math.min(Math.max(devicePixelRatio || 1, 1), cap),
  };
}
