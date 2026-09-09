import {
  PeerGameConnection,
  enterPeerRoom,
} from '../../shared/peer/connection';
import type { Action, Input, Snapshot } from './types';
import type { Session } from '../../shared/rooms/session';
type Reply = {
  session?: Session;
  snapshot?: Snapshot;
  error?: string;
  ok?: boolean;
};
export class NetworkError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function requestRoom(body: object): Promise<Reply> {
  if (
    typeof window !== 'undefined' &&
    ['create', 'join'].includes(String((body as { op?: string }).op))
  ) {
    try {
      return await enterPeerRoom<Snapshot>(
        'stack-or-sink',
        body,
        () => import('./peer'),
      );
    } catch (error) {
      if (
        (body as { op?: string }).op !== 'join' ||
        (error as { status?: number }).status !== 404
      )
        throw error;
    }
  }
  const response = await fetch('/api/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let data: Reply;
  try {
    data = await response.json();
  } catch {
    throw new NetworkError(
      'The connection was interrupted. Try again.',
      response.status,
    );
  }
  if (!response.ok)
    throw new NetworkError(
      data.error || 'Could not reach your crew.',
      response.status,
    );
  return data;
}
export class Connection {
  private peer?: PeerGameConnection<Snapshot>;
  stopped = false;
  timer: ReturnType<typeof setTimeout> | undefined;
  input: Input = { x: 0, z: 0, jump: false, seq: 0 };
  version = -1;
  queue: Promise<unknown> = Promise.resolve();
  failures = 0;
  polling = false;
  dirty = false;
  order = Date.now();
  constructor(
    public session: Session,
    public onState: (s: Snapshot) => void,
    public onStatus: (status: 'online' | 'reconnecting' | 'expired') => void,
  ) {
    this.input.order = this.order;
    if (session.peer)
      this.peer = new PeerGameConnection(
        'stack-or-sink',
        session,
        () => this.input,
        onState,
        onStatus,
        () => import('./peer'),
      );
  }
  accept(s?: Snapshot) {
    if (s && s.version >= this.version) {
      this.version = s.version;
      this.onState(s);
    }
  }
  start() {
    if (this.peer) {
      this.peer.start();
      return;
    }
    void this.poll();
  }
  setInput(input: Input) {
    if (this.peer) {
      this.input = input;
      return;
    }
    const before = this.input;
    if (
      before.x === input.x &&
      before.z === input.z &&
      before.jump === input.jump &&
      before.seq === input.seq
    )
      return;
    this.input = { ...input, order: ++this.order };
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    if (!this.polling && !this.stopped) void this.poll();
  }
  private async poll() {
    if (this.stopped || this.polling) return;
    this.polling = true;
    this.dirty = false;
    try {
      const reply = await requestRoom({
        op: 'sync',
        ...this.session,
        input: this.input,
      });
      if (this.stopped) return;
      this.accept(reply.snapshot);
      this.failures = 0;
      this.onStatus('online');
    } catch (e) {
      if (this.stopped) return;
      this.failures++;
      if (e instanceof NetworkError && (e.status === 401 || e.status === 404)) {
        this.onStatus('expired');
        this.stop();
        return;
      }
      this.onStatus('reconnecting');
    } finally {
      this.polling = false;
    }
    if (!this.stopped)
      this.timer = setTimeout(
        () => void this.poll(),
        this.failures
          ? Math.min(3000, this.failures * 500)
          : this.dirty
            ? 0
            : 60,
      );
  }
  async action(action: Action) {
    if (this.peer) return this.peer.action(action);
    const requestId = crypto.randomUUID();
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        if (this.stopped)
          throw new Error('Reconnect to the crew before playing.');
        const reply = await requestRoom({
          op: 'action',
          ...this.session,
          input: this.input,
          action,
          requestId,
        });
        if (!this.stopped) this.accept(reply.snapshot);
      });
    this.queue = task;
    return task;
  }
  stop() {
    this.peer?.stop();
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
  async leave() {
    if (this.peer) {
      await this.peer.leave();
      return;
    }
    this.stop();
    await requestRoom({ op: 'leave', ...this.session }).catch(() => {});
  }
}
