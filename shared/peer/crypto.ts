import type { SealedCheckpoint } from './types';

export const bytesToBase64 = (bytes: Uint8Array) => {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
};
export const base64ToBytes = (text: string) =>
  Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
export const newCheckpointKey = () =>
  bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
const aad = (scope: string, epoch: number, seq: number) =>
  new TextEncoder().encode(`${scope}:${epoch}:${seq}`);
export async function sealCheckpoint(
  value: unknown,
  key: string,
  scope: string,
  epoch: number,
  seq: number,
): Promise<SealedCheckpoint> {
  const secret = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(key),
    'AES-GCM',
    false,
    ['encrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(scope, epoch, seq) },
    secret,
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return {
    epoch,
    seq,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(data)),
  };
}
export async function openCheckpoint<T>(
  value: SealedCheckpoint,
  key: string,
  scope: string,
): Promise<T> {
  const secret = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(key),
    'AES-GCM',
    false,
    ['decrypt'],
  );
  const data = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(value.iv),
      additionalData: aad(scope, value.epoch, value.seq),
    },
    secret,
    base64ToBytes(value.data),
  );
  return JSON.parse(new TextDecoder().decode(data)) as T;
}
