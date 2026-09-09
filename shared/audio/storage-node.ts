import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { isGameId } from './types';

function directory() {
  return resolve(
    dirname(process.env.DATABASE_PATH || 'data/stack-or-sink.sqlite'),
    'audio',
  );
}
function filename(key: string) {
  const parts = key.split('/');
  if (
    parts.length !== 2 ||
    !isGameId(parts[0]) ||
    !/^[a-f0-9-]{36}\.mp3$/.test(parts[1])
  )
    throw new Error('Invalid audio file.');
  return resolve(directory(), key);
}
export async function masterKey() {
  const supplied = process.env.AUDIO_MASTER_KEY;
  if (supplied) {
    if (!/^[a-f0-9]{64}$/i.test(supplied))
      throw new Error(
        'AUDIO_MASTER_KEY must contain 64 hexadecimal characters.',
      );
    return supplied;
  }
  const folder = directory(),
    path = resolve(folder, '.master-key');
  await mkdir(folder, { recursive: true, mode: 0o700 });
  try {
    return (await readFile(path, 'utf8')).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  try {
    await writeFile(path, randomBytes(32).toString('hex'), {
      flag: 'wx',
      mode: 0o600,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  return (await readFile(path, 'utf8')).trim();
}
export async function putAudio(key: string, bytes: Uint8Array) {
  const path = filename(key);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
}
export async function getAudio(key: string): Promise<ArrayBuffer | null> {
  try {
    const data = await readFile(filename(key));
    return data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) as ArrayBuffer;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
export async function deleteAudio(key: string) {
  await unlink(filename(key)).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
}
