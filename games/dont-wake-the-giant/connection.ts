import {
  PeerGameConnection,
  enterPeerRoom,
} from '../../shared/peer/connection';
import {
  idleInput,
  type GiantInput,
  type GiantAction,
  type GiantSession,
  type GiantSnapshot,
} from './types';
export class GiantNetworkError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
type Reply = {
  session?: GiantSession;
  snapshot?: GiantSnapshot;
  error?: string;
};
export async function requestGiant(body: object): Promise<Reply> {
  if (
    typeof window !== 'undefined' &&
    ['create', 'join'].includes(String((body as { op?: string }).op))
  ) {
    try {
      return await enterPeerRoom<GiantSnapshot>(
        'dont-wake-the-giant',
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
  const res = await fetch('/api/dont-wake-the-giant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let reply: Reply;
  try {
    reply = await res.json();
  } catch {
    throw new GiantNetworkError(
      'Connection interrupted. Try again.',
      res.status,
    );
  }
  if (!res.ok)
    throw new GiantNetworkError(
      reply.error ?? 'Could not reach the giant.',
      res.status,
    );
  return reply;
}
export class GiantConnection {
  private peer?: PeerGameConnection<GiantSnapshot>;
  input: GiantInput = idleInput();
  stopped = false;
  version = -1;
  failures = 0;
  timer: ReturnType<typeof setTimeout> | undefined;
  queue: Promise<unknown> = Promise.resolve();
  constructor(
    public session: GiantSession,
    public receive: (s: GiantSnapshot) => void,
    public status: (s: 'online' | 'reconnecting' | 'expired') => void,
  ) {
    if (session.peer)
      this.peer = new PeerGameConnection(
        'dont-wake-the-giant',
        session,
        () =>
          (() => {
            const input = this.input;
            this.input = { ...input, jump: false };
            return input;
          })(),
        receive,
        status,
        () => import('./peer'),
      );
  }
  accept(s?: GiantSnapshot) {
    if (!this.stopped && s && s.version >= this.version) {
      this.version = s.version;
      this.receive(s);
    }
  }
  async poll() {
    if (this.peer) {
      this.peer.start();
      return;
    }
    if (this.stopped) return;
    try {
      const input = this.input;
      this.input = { ...input, jump: false };
      const r = await requestGiant({
        op: 'sync',
        ...this.session,
        input,
      });
      if (this.stopped) return;
      this.accept(r.snapshot);
      this.failures = 0;
      this.status('online');
    } catch (e) {
      if (this.stopped) return;
      if (
        e instanceof GiantNetworkError &&
        (e.status === 401 || e.status === 404)
      ) {
        this.status('expired');
        this.stop();
        return;
      }
      this.status('reconnecting');
      this.failures++;
    }
    if (!this.stopped)
      this.timer = setTimeout(
        () => void this.poll(),
        this.failures ? Math.min(3000, this.failures * 500) : 100,
      );
  }
  action(action: GiantAction) {
    if (this.peer) return this.peer.action(action);
    const requestId = crypto.randomUUID();
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        if (this.stopped)
          throw new Error('Reconnect to the giant before playing.');
        this.accept(
          (
            await requestGiant({
              op: 'action',
              ...this.session,
              input: this.input,
              action,
              requestId,
            })
          ).snapshot,
        );
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
    await requestGiant({ op: 'leave', ...this.session }).catch(() => {});
  }
}
