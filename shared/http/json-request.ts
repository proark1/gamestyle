import { RoomError } from '../rooms/types';

/** Bound raw bytes and total read time, including chunked and stalled uploads. */
export async function readJsonObject(
  request: Request,
  maxBytes = 4096,
  timeoutMs = 10_000,
) {
  if (Number(request.headers.get('content-length')) > maxBytes) {
    void request.body?.cancel().catch(() => {});
    throw new RoomError('Request too large.', 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new RoomError('Invalid request.');
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let raw = '',
    bytes = 0;
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RoomError('Request timed out.', 408));
      void reader.cancel().catch(() => {});
    }, timeoutMs);
  });
  try {
    await Promise.race([
      (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > maxBytes) throw new RoomError('Request too large.', 413);
          raw += decoder.decode(value, { stream: true });
        }
        raw += decoder.decode();
      })(),
      deadline,
    ]);
    const body: unknown = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new RoomError('Invalid request.');
    return body as Record<string, unknown>;
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof RoomError) throw error;
    throw new RoomError('Invalid request.');
  } finally {
    clearTimeout(timer!);
    reader.releaseLock();
  }
}
