import { MIN_POLL_MS, quantizeAxis } from '../../shared/rooms/input-rate';
import {
  idleInput,
  type Action,
  type Point,
  type Session,
  type Snapshot,
  type SnapshotTiming,
} from './types';
export class ShelfNetworkError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
type Reply = { session?: Session; snapshot?: Snapshot; error?: string };
export async function requestShelf(
  body: object,
  signal?: AbortSignal,
): Promise<Reply> {
  const response = await fetch('/api/shelf-control', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(8000)])
      : AbortSignal.timeout(8000),
  });
  let reply: Reply;
  try {
    reply = await response.json();
  } catch {
    throw new ShelfNetworkError(
      'Connection interrupted. Try again.',
      response.status,
    );
  }
  if (!response.ok)
    throw new ShelfNetworkError(
      reply.error ?? 'Could not reach the shop.',
      response.status,
    );
  return reply;
}
export class ShelfConnection {
  input = idleInput(Date.now() * 1000);
  private stopped = false;
  private timer?: ReturnType<typeof setTimeout>;
  private version = -1;
  private failures = 0;
  private polling = false;
  private wake = false;
  private actionQueue: Promise<unknown> = Promise.resolve();
  private abort = new AbortController();
  constructor(
    public session: Session,
    private receive: (snapshot: Snapshot, timing?: SnapshotTiming) => void,
    private status: (status: 'online' | 'reconnecting' | 'expired') => void,
  ) {}
  move(point: Point) {
    const x = quantizeAxis(point.x),
      z = quantizeAxis(point.z);
    if (x !== this.input.x || z !== this.input.z) {
      this.input = { ...point, x, z, seq: this.input.seq + 1 };
      if (this.polling) this.wake = true;
      else if (!this.stopped) {
        clearTimeout(this.timer);
        void this.poll();
      }
    }
    return this.input;
  }
  private accept(snapshot?: Snapshot, timing?: SnapshotTiming) {
    if (!this.stopped && snapshot && snapshot.version > this.version) {
      this.version = snapshot.version;
      this.receive(snapshot, timing);
    }
  }
  async poll() {
    if (this.stopped || this.polling) return;
    this.polling = true;
    this.wake = false;
    const sentAt = performance.now(),
      input = { ...this.input };
    try {
      const reply = await requestShelf(
        { op: 'sync', ...this.session, input },
        this.abort.signal,
      );
      this.accept(reply.snapshot, {
        sentAt,
        receivedAt: performance.now(),
        input,
      });
      this.failures = 0;
      if (!this.stopped) this.status('online');
    } catch (error) {
      if (this.stopped) return;
      if (
        error instanceof ShelfNetworkError &&
        [401, 404].includes(error.status)
      ) {
        this.status('expired');
        this.stop();
        return;
      }
      this.failures++;
      this.status('reconnecting');
    } finally {
      this.polling = false;
    }
    if (!this.stopped)
      this.timer = setTimeout(
        () => void this.poll(),
        this.failures
          ? Math.min(2500, this.failures * 400)
          : this.wake
            ? MIN_POLL_MS
            : Math.max(0, 65 - (performance.now() - sentAt)),
      );
  }
  action(action: Action) {
    const requestId = crypto.randomUUID();
    const task = this.actionQueue
      .catch(() => {})
      .then(async () => {
        if (this.stopped) throw new Error('Reconnect before playing.');
        const sentAt = performance.now(),
          input = { ...this.input };
        const reply = await requestShelf(
          {
            op: 'action',
            ...this.session,
            action,
            input,
            requestId,
          },
          this.abort.signal,
        );
        this.accept(reply.snapshot, {
          sentAt,
          receivedAt: performance.now(),
          input,
        });
      });
    this.actionQueue = task;
    return task;
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.abort.abort();
  }
  async leave() {
    this.stop();
    await requestShelf({ op: 'leave', ...this.session }).catch(() => {});
  }
}
