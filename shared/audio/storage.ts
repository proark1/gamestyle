import { env } from 'cloudflare:workers';
import type { R2Bucket } from '@cloudflare/workers-types/index.ts';
import { AudioError } from './provider';

export async function masterKey(): Promise<string> {
  const value = (env as unknown as Record<string, unknown>).AUDIO_MASTER_KEY;
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value))
    throw new AudioError(
      'Secure key storage is not configured: AUDIO_MASTER_KEY is missing on the server.',
    );
  return value;
}
function bucket() {
  const value = (env as unknown as { AUDIO?: R2Bucket }).AUDIO;
  if (!value)
    throw new AudioError('Audio storage is not configured on the server.');
  return value;
}
export async function putAudio(key: string, bytes: Uint8Array) {
  await bucket().put(key, bytes, {
    httpMetadata: { contentType: 'audio/mpeg' },
  });
}
export async function getAudio(key: string): Promise<ArrayBuffer | null> {
  const object = await bucket().get(key);
  return object ? object.arrayBuffer() : null;
}
export async function deleteAudio(key: string) {
  await bucket().delete(key);
}
