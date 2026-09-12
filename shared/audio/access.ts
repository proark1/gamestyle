import { hasAllowedOrigin } from '../http/request-origin';

export async function audioAccess(
  request: Request,
  password = process.env.AUDIO_ADMIN_PASSWORD,
) {
  const configured =
    !!password && password.length >= 16 && password.length <= 256;
  let supplied = '';
  try {
    supplied = decodeURIComponent(request.headers.get('x-audio-admin') || '');
  } catch {
    /* Invalid credentials. */
  }
  if (!configured || !supplied || supplied.length > 256)
    return { configured, authorized: false };
  const digest = async (value: string) =>
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
    );
  const [expected, actual] = await Promise.all([
    digest(password!),
    digest(supplied),
  ]);
  let difference = 0;
  for (let i = 0; i < expected.length; i++)
    difference |= expected[i] ^ actual[i];
  return { configured, authorized: difference === 0 };
}

/** Origin validation supplements authentication; it is not an administrator credential. */
export function canEditAudio(
  request: Request,
  publicOrigin = process.env.PUBLIC_GAME_ORIGIN,
) {
  return hasAllowedOrigin(request, publicOrigin);
}
