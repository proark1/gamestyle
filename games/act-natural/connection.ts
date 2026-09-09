import {
  PeerGameConnection,
  enterPeerRoom,
} from '../../shared/peer/connection';
import {
  idleInput,
  type CowInput,
  type FarmAction,
  type FarmSession,
  type FarmSnapshot,
} from './types';
export class FarmNetworkError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
type Reply = { session?: FarmSession; snapshot?: FarmSnapshot; error?: string };
export async function requestFarm(body: object): Promise<Reply> {
  // Hidden-role rooms run on the server. A player hosting a peer simulation
  // would otherwise hold every cow identity and inventory on their device.
  const res = await fetch('/api/act-natural', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let reply: Reply;
  try {
    reply = await res.json();
  } catch {
    throw new FarmNetworkError(
      'Connection interrupted. Try again.',
      res.status,
    );
  }
  // Keep invites to existing peer rooms usable; never create new peer farms.
  if (
    res.status === 404 &&
    typeof window !== 'undefined' &&
    (body as { op?: string }).op === 'join'
  )
    return enterPeerRoom<FarmSnapshot>(
      'act-natural',
      body,
      () => import('./peer'),
    );
  if (!res.ok)
    throw new FarmNetworkError(
      reply.error ?? 'Could not reach the farm.',
      res.status,
    );
  return reply;
}
export class FarmConnection {
  private peer?: PeerGameConnection<FarmSnapshot>;
  private controls: CowInput = idleInput();
  private sequence = 0;
  private polling = false;
  private urgent = false;
  private sentAt = -Infinity;
  get input() {
    return this.controls;
  }
  set input(value: CowInput) {
    if (
      value.x === this.controls.x &&
      value.z === this.controls.z &&
      value.graze === this.controls.graze
    )
      return;
    this.controls = { ...value };
    this.sequence++;
    this.urgent = true;
    if (!this.peer && !this.polling && !this.stopped && this.timer) {
      clearTimeout(this.timer);
      this.timer = setTimeout(
        () => void this.poll(),
        Math.max(0, 35 - (performance.now() - this.sentAt)),
      );
    }
  }
  stopped = false;
  version = -1;
  failures = 0;
  timer: ReturnType<typeof setTimeout> | undefined;
  queue: Promise<unknown> = Promise.resolve();
  constructor(
    public session: FarmSession,
    public receive: (s: FarmSnapshot) => void,
    public status: (s: 'online' | 'reconnecting' | 'expired') => void,
  ) {
    if (session.peer)
      this.peer = new PeerGameConnection(
        'act-natural',
        session,
        () => this.input,
        receive,
        status,
        () => import('./peer'),
      );
  }
  accept(s?: FarmSnapshot) {
    if (!this.stopped && s && s.version >= this.version) {
      this.version = s.version;
      this.sequence = Math.max(this.sequence, s.you.motion?.sequence ?? 0);
      this.receive(s);
    }
  }
  async poll() {
    if (this.peer) {
      this.peer.start();
      return;
    }
    if (this.stopped || this.polling) return;
    this.polling = true;
    this.urgent = false;
    this.sentAt = performance.now();
    try {
      const r = await requestFarm({
        op: 'sync',
        ...this.session,
        input: this.input,
        inputSequence: this.sequence,
      });
      if (this.stopped) return;
      this.accept(
        r.snapshot && {
          ...r.snapshot,
          latencyMs: Math.min(250, (performance.now() - this.sentAt) / 2),
        },
      );
      this.failures = 0;
      this.status('online');
    } catch (e) {
      if (this.stopped) return;
      if (
        e instanceof FarmNetworkError &&
        (e.status === 401 || e.status === 404)
      ) {
        this.status('expired');
        this.stop();
        return;
      }
      this.status('reconnecting');
      this.failures++;
    } finally {
      this.polling = false;
    }
    if (!this.stopped)
      this.timer = setTimeout(
        () => void this.poll(),
        this.failures
          ? Math.min(3000, this.failures * 500)
          : Math.max(
              15,
              (this.urgent ? 35 : 75) - (performance.now() - this.sentAt),
            ),
      );
  }
  action(action: FarmAction) {
    if (this.peer) return this.peer.action(action);
    const requestId = crypto.randomUUID();
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        if (this.stopped)
          throw new Error('Reconnect to the farm before playing.');
        const started = performance.now();
        const reply = await requestFarm({
          op: 'action',
          ...this.session,
          input: this.input,
          inputSequence: this.sequence,
          action,
          requestId,
        });
        this.accept(
          reply.snapshot && {
            ...reply.snapshot,
            latencyMs: Math.min(250, (performance.now() - started) / 2),
          },
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
    await requestFarm({ op: 'leave', ...this.session }).catch(() => {});
  }
}
