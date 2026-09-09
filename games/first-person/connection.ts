import type { Action, Position, Session, Snapshot } from './model';
const ENDPOINT = '/api/handwerker/first-person/rooms';
export class ConnectionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function request(
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<{ session?: Session; snapshot: Snapshot }> {
  const timed = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
    : AbortSignal.timeout(10_000);
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: timed,
  });
  const data = (await response.json()) as {
    error?: string;
    session?: Session;
    snapshot: Snapshot;
  };
  if (!response.ok)
    throw new ConnectionError(
      data.error || 'The connection was interrupted.',
      response.status,
    );
  return data;
}
export class Connection {
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private controller = new AbortController();
  private lastVersion = -1;
  private lastTime = 0;
  private busy = false;
  constructor(
    public session: Session,
    private pose: () => Position,
    private update: (s: Snapshot) => void,
    private error: (e: Error) => void,
  ) {
    void this.poll();
  }
  private accept(s: Snapshot) {
    if (
      !this.stopped &&
      s.version >= this.lastVersion &&
      s.now >= this.lastTime
    ) {
      this.lastVersion = s.version;
      this.lastTime = s.now;
      this.update(s);
    }
  }
  private async poll() {
    try {
      const { snapshot } = await request(
        { op: 'sync', ...this.session, position: this.pose() },
        this.controller.signal,
      );
      this.accept(snapshot);
    } catch (e) {
      if (!this.stopped) this.error(e as Error);
    }
    if (!this.stopped) this.timer = setTimeout(() => this.poll(), 220);
  }
  async act(action: Action) {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try {
      const { snapshot } = await request(
        {
          op: 'action',
          ...this.session,
          action,
          actionId: crypto.randomUUID(),
          position: this.pose(),
        },
        this.controller.signal,
      );
      this.accept(snapshot);
      return true;
    } catch (e) {
      if (!this.stopped) this.error(e as Error);
      return false;
    } finally {
      this.busy = false;
    }
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.controller.abort();
  }
}
