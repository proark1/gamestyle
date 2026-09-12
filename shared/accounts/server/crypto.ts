import { hashToken } from '../../rooms/identity';

const encoder = new TextEncoder();

export function base64url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

/** Throws on malformed input. */
export function fromBase64url(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(
    atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')),
    (char) => char.charCodeAt(0),
  );
}

/** 32 random bytes as 43 URL-safe characters. */
export function randomToken(bytes = 32) {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export const randomId = () => crypto.randomUUID().replaceAll('-', '');

/** SHA-256 in hex, the digest room tokens already use. */
export const sha256 = hashToken;

let cachedKey: { secret: string; key: Promise<CryptoKey> } | undefined;

/** HMAC-SHA256 in hex, keyed by the server secret. */
export async function hmac(secret: string, value: string) {
  const entry =
    cachedKey?.secret === secret
      ? cachedKey
      : (cachedKey = {
          secret,
          key: crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign'],
          ),
        });
  const signature = await crypto.subtle.sign(
    'HMAC',
    await entry.key,
    encoder.encode(value),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

/** Compares in time that depends only on the length. */
export function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/** The S256 challenge for a PKCE verifier. */
export async function pkceChallenge(verifier: string) {
  return base64url(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(verifier)),
    ),
  );
}

/** Six uniformly random digits: rejection sampling avoids modulo bias. */
export function sixDigitCode() {
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000;
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);
  return String(value[0] % 1_000_000).padStart(6, '0');
}

/** Signs a small JSON payload so a cookie can carry it unchanged. */
export async function seal(secret: string, purpose: string, payload: object) {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(secret, `${purpose}:${body}`)}`;
}

export async function unseal(
  secret: string,
  purpose: string,
  sealed: string | undefined,
): Promise<Record<string, unknown> | null> {
  const dot = sealed?.lastIndexOf('.') ?? -1;
  if (!sealed || dot < 1 || sealed.length > 2048) return null;
  const body = sealed.slice(0, dot);
  const signature = await hmac(secret, `${purpose}:${body}`);
  if (!sameText(sealed.slice(dot + 1), signature)) return null;
  try {
    const value: unknown = JSON.parse(
      new TextDecoder().decode(fromBase64url(body)),
    );
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
