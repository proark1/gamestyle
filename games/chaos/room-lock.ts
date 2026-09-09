// Serialize one site's read/modify/write work inside this server process.
// The database version check still arbitrates between separate server instances.
const tails = new Map<string, Promise<void>>();
export async function withRoomLock<T>(
  code: string,
  run: () => Promise<T>,
): Promise<T> {
  const previous = tails.get(code) || Promise.resolve();
  let release!: () => void;
  const tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  tails.set(code, tail);
  await previous;
  try {
    return await run();
  } finally {
    release();
    if (tails.get(code) === tail) tails.delete(code);
  }
}
