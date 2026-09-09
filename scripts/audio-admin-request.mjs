/** CLI credentials are used only for workshop APIs, never media/provider URLs. */
export function audioAdminFetch(input, init = {}) {
  const url = new URL(input);
  if (!/^\/api\/(?:handwerker\/)?audio\/[a-z-]+$/.test(url.pathname))
    return fetch(input, init);
  const password = process.env.AUDIO_ADMIN_PASSWORD;
  const headers = new Headers(init.headers);
  if (password) {
    if (
      url.protocol !== 'https:' &&
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
      throw new Error('Use HTTPS for administrator requests.');
    headers.set('x-audio-admin', encodeURIComponent(password));
  }
  return fetch(input, { ...init, headers, redirect: 'error' });
}
