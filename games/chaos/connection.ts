import type { Action, Snapshot } from './model';

export type Session = { code: string; id: string; token: string };
export type Position = {
  x: number;
  y?: number;
  z: number;
  angle: number;
  jump: number;
};
export async function requestRoom(body: object, signal?: AbortSignal) {
  const response = await fetch('/api/handwerker/rooms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: signal || AbortSignal.timeout(10000),
  });
  const data = (await response.json()) as {
    error?: string;
    snapshot: Snapshot;
    session: Session;
  };
  if (!response.ok) {
    const error = new Error(
      data.error || 'No connection to the building site.',
    );
    Object.assign(error, { status: response.status });
    throw error;
  }
  return data;
}
export class Connection {
  position: Position = { x: 0, z: 5.8, angle: Math.PI, jump: 0 };
  timer: ReturnType<typeof setTimeout> | null = null;
  stopped = false;
  busy = false;
  version = -1;
  sequence = 0;
  roundId: string | undefined;
  carrying = false;
  private actionQueue: Promise<unknown> = Promise.resolve();
  lastNow = 0;
  failures = 0;
  onState: (snapshot: Snapshot) => void;
  onStatus: (
    status: 'online' | 'reconnecting' | 'expired',
    message?: string,
  ) => void;
  constructor(
    public session: Session,
    onState: Connection['onState'],
    onStatus: Connection['onStatus'],
  ) {
    this.onState = onState;
    this.onStatus = onStatus;
  }
  accept(snapshot: Snapshot) {
    if (snapshot.version >= this.version && snapshot.now >= this.lastNow) {
      this.roundId = snapshot.world.party?.roundId;
      this.sequence = Math.max(this.sequence, snapshot.actionSeq || 0);
      this.carrying = !!snapshot.world.party?.task.roles.includes(
        this.session.id,
      );
      this.version = snapshot.version;
      this.lastNow = snapshot.now;
      this.onState(snapshot);
    }
  }
  async poll() {
    if (this.stopped) return;
    if (!this.busy) {
      this.busy = true;
      try {
        const result = await requestRoom({
          op: 'sync',
          ...this.session,
          position: this.position,
        });
        if (this.stopped) return;
        this.accept(result.snapshot);
        this.failures = 0;
        this.onStatus('online');
      } catch (error) {
        if (this.stopped) return;
        this.failures++;
        if ((error as { status?: number }).status === 401) {
          this.onStatus('expired', (error as Error).message);
          this.stop();
          return;
        }
        this.onStatus('reconnecting');
      } finally {
        this.busy = false;
      }
    }
    if (!this.stopped)
      this.timer = setTimeout(
        () => void this.poll(),
        this.failures
          ? Math.min(4000, 600 * this.failures)
          : this.carrying
            ? 350
            : 220,
      );
  }
  action(action: Action): Promise<Snapshot> {
    const roundId = this.roundId;
    // Preserve the intent and aim at activation, even while another action is queued.
    const position = { ...this.position };
    const intent = structuredClone(action);
    const run = async () => {
      if (this.stopped) throw new Error('This site connection is closed.');
      if (roundId !== this.roundId)
        throw new Error('The round changed. Try your action again.');
      const body = {
        op: 'action',
        ...this.session,
        position,
        action: intent,
        actionId: crypto.randomUUID(),
        seq: ++this.sequence,
        roundId,
      };
      let result;
      try {
        result = await requestRoom(body);
      } catch (error) {
        // A lost response may have committed. Reuse the identity instead of doing the action twice.
        if (
          this.stopped ||
          (error as { status?: number }).status ||
          (intent.type === 'party' && intent.op === 'drive')
        )
          throw error;
        result = await requestRoom(body);
      }
      if (!this.stopped) this.accept(result.snapshot);
      return result.snapshot;
    };
    const pending = this.actionQueue.then(run, run);
    this.actionQueue = pending.catch(() => {});
    return pending;
  }
  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }
  async leave() {
    this.stop();
    await requestRoom({ op: 'leave', ...this.session }).catch(() => {});
  }
}
