import { Capacitor } from '@capacitor/core';

declare const __GAME_API_ORIGIN__: string | undefined;

export function nativeApiUrl(input: string, origin: string): string {
  const base = new URL(origin);
  if (base.protocol !== 'https:' || base.username || base.password)
    throw new Error(
      'The installed client requires a trusted HTTPS API origin.',
    );
  return input.startsWith('/api/') ? new URL(input, base.origin).href : input;
}

/** Web stays same-origin. Packaged native fetch is handled by CapacitorHttp. */
export function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (
    !Capacitor.isNativePlatform() ||
    typeof input !== 'string' ||
    !input.startsWith('/api/')
  )
    return fetch(input, init);
  const origin =
    typeof __GAME_API_ORIGIN__ === 'string'
      ? __GAME_API_ORIGIN__
      : 'https://www.jumbleyard.com';
  const url = nativeApiUrl(input, origin);
  const headers = new Headers(init?.headers);
  // Native HTTP is not a browser origin. Only our explicit backend receives this header.
  headers.set('Origin', new URL(origin).origin);
  return fetch(url, {
    ...init,
    headers,
    credentials: init?.credentials ?? 'include',
  });
}
