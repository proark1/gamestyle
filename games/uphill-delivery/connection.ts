import { MIN_POLL_MS, quantizeAxis } from '../../shared/rooms/input-rate';
import {
  PeerGameConnection,
  enterPeerRoom,
} from '../../shared/peer/connection';
import { isNpcAction, type NpcAction } from '../../shared/rooms/npc-slots';
import {
  idleInput,
  type DeliveryInput,
  type DeliveryAction,
  type DeliverySession,
  type DeliverySnapshot,
} from './types';
export class DeliveryNetworkError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
type Reply = {
  session?: DeliverySession;
  snapshot?: DeliverySnapshot;
  error?: string;
};
export async function requestDelivery(body: object): Promise<Reply> {
  if (
    typeof window !== 'undefined' &&
    ['create', 'join'].includes(String((body as { op?: string }).op))
  ) {
    try {
      return await enterPeerRoom<DeliverySnapshot>(
        'uphill-delivery',
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
  const res = await fetch('/api/uphill-delivery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  let reply: Reply;
  try {
    reply = await res.json();
  } catch {
    throw new DeliveryNetworkError(
      'Connection interrupted. Try again.',
      res.status,
    );
  }
  if (!res.ok)
    throw new DeliveryNetworkError(
      reply.error ?? 'Could not reach the delivery.',
      res.status,
    );
  return reply;
}
export class DeliveryConnection {
  private peer?: PeerGameConnection<DeliverySnapshot>;
  input: DeliveryInput = idleInput();
  stopped = false;
  version = -1;
  failures = 0;
  polling = false;
  dirty = false;
  timer: ReturnType<typeof setTimeout> | undefined;
  queue: Promise<unknown> = Promise.resolve();
  constructor(
    public session: DeliverySession,
    public receive: (s: DeliverySnapshot) => void,
    public status: (s: 'online' | 'reconnecting' | 'expired') => void,
  ) {
    if (session.peer)
      this.peer = new PeerGameConnection(
        'uphill-delivery',
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
  accept(s?: DeliverySnapshot) {
    if (!this.stopped && s && s.version >= this.version) {
      this.version = s.version;
      this.receive(s);
    }
  }
  setInput(input: DeliveryInput) {
    if (this.peer) {
      this.input = { ...input, jump: input.jump || this.input.jump };
      return;
    }
    const next = {
      ...input,
      x: quantizeAxis(input.x),
      z: quantizeAxis(input.z),
    };
    const changed =
      next.x !== this.input.x || next.z !== this.input.z || next.jump;
    this.input = { ...next, jump: next.jump || this.input.jump };
    if (!changed || this.stopped) return;
    this.dirty = true;
    // Preserve reconnect backoff even when a joystick keeps producing events.
    if (this.failures) return;
    if (this.timer) clearTimeout(this.timer);
    if (!this.polling) void this.poll();
  }
  async poll() {
    if (this.peer) {
      this.peer.start();
      return;
    }
    if (this.stopped || this.polling) return;
    this.polling = true;
    this.dirty = false;
    const started = performance.now();
    try {
      const input = this.input;
      this.input = { ...input, jump: false };
      const r = await requestDelivery({
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
        e instanceof DeliveryNetworkError &&
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
          : this.dirty
            ? MIN_POLL_MS
            : Math.max(0, 80 - (performance.now() - started)),
      );
  }
  action(action: DeliveryAction) {
    if (this.peer)
      return isNpcAction(action)
        ? this.peer.manageNpcs(action as NpcAction)
        : this.peer.action(action);
    const requestId = crypto.randomUUID();
    const task = this.queue
      .catch(() => {})
      .then(async () => {
        if (this.stopped)
          throw new Error('Reconnect to the delivery before playing.');
        this.accept(
          (
            await requestDelivery({
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
    await requestDelivery({ op: 'leave', ...this.session }).catch(() => {});
  }
}
