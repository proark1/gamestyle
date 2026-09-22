import { Capacitor } from '@capacitor/core';
declare const __GAME_PUBLIC_ORIGIN__: string | undefined;
const canonical = 'https://www.jumbleyard.com';
/** Installed origins are private to a device; invitations always open a public website. */
export function publicGameOrigin(
  origin = typeof location === 'undefined' ? canonical : location.origin,
  native = Capacitor.isNativePlatform(),
) {
  if (!native && /^https?:\/\//.test(origin)) return new URL(origin).origin;
  const configured =
    typeof __GAME_PUBLIC_ORIGIN__ === 'string'
      ? __GAME_PUBLIC_ORIGIN__
      : canonical;
  try {
    const url = new URL(configured);
    if (url.protocol === 'https:' && !url.username && !url.password)
      return url.origin;
  } catch {
    /* Use the canonical public site. */
  }
  return canonical;
}
