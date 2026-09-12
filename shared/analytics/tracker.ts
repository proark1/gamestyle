import {
  ANALYTICS_ENDPOINT,
  ANALYTICS_VERSION,
  MAX_BATCH_BYTES,
  MAX_BATCH_EVENTS,
  MAX_COUNTED_KINDS,
  MAX_SESSION_EVENTS,
  stepOrder,
  toKey,
  type Batch,
  type Device,
  type Entry,
  type EventData,
  type EventType,
  type Exit,
  type GameAnalytics,
  type Mode,
  type PlayState,
  type SessionSummary,
  type Stage,
  type WireEvent,
} from './protocol';

export type Visit = { device: Device; entry: Entry };

/** Everything the tracker needs from the page, replaceable in tests. */
export type TrackerEnvironment = {
  id(): string;
  now(): number;
  visit(): Visit;
  visible(): boolean;
  hash(value: string): Promise<string>;
  /** Subscribes to page lifecycle and returns the unsubscribe function. */
  listen(handlers: {
    visibility(visible: boolean): void;
    hide(): void;
    show(): void;
  }): () => void;
  /** Resolves true once the report no longer needs resending. */
  send(body: string, final: boolean): Promise<boolean>;
};

const FIRST_REPORT_MS = 2_000;
const REPORT_MS = 15_000;
const KEEPALIVE_MS = 60_000;
const TICK_MS = 5_000;
/** Tab switches and crew changes can repeat; cap them so the timeline stays readable. */
const NOISY_EVENTS = 60;
const INVITE_PARAMS = ['room', 'raum'];

export function browserEnvironment(
  endpoint = ANALYTICS_ENDPOINT,
): TrackerEnvironment {
  if (typeof window === 'undefined')
    throw new Error('Analytics run only in the browser.');
  return {
    id() {
      if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      // Plain-HTTP LAN pages have no randomUUID, but do have getRandomValues.
      return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
    },
    now: () => performance.now(),
    visit() {
      const device: Device = window.matchMedia?.('(pointer: coarse)').matches
        ? 'touch'
        : 'pointer';
      const navigation = performance.getEntriesByType?.('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
      // Games rewrite the address to their room link, so a reload is not an invite.
      if (navigation?.type === 'reload') return { device, entry: 'reload' };
      const query = new URLSearchParams(window.location.search);
      if (INVITE_PARAMS.some((name) => query.has(name)))
        return { device, entry: 'invite' };
      try {
        if (!document.referrer) return { device, entry: 'direct' };
        const from = new URL(document.referrer);
        if (from.origin !== window.location.origin)
          return { device, entry: 'external' };
        return { device, entry: from.pathname === '/' ? 'home' : 'game' };
      } catch {
        return { device, entry: 'direct' };
      }
    },
    visible: () => document.visibilityState === 'visible',
    async hash(value) {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(value),
      );
      return Array.from(new Uint8Array(digest).slice(0, 5), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
    },
    listen(handlers) {
      const visibility = () =>
        handlers.visibility(document.visibilityState === 'visible');
      const hide = () => handlers.hide();
      const show = (event: PageTransitionEvent) => {
        if (event.persisted) handlers.show();
      };
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('pagehide', hide);
      window.addEventListener('pageshow', show);
      return () => {
        document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('pagehide', hide);
        window.removeEventListener('pageshow', show);
      };
    },
    async send(body) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body,
          keepalive: true,
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json' },
        });
        // A rejected report will be rejected again; only retry when the server is busy.
        return (
          response.ok ||
          ![408, 429, 500, 502, 503, 504].includes(response.status)
        );
      } catch {
        // No sendBeacon fallback: a beacon always carries cookies, and reports
        // must never travel with a player's sign-in cookie.
        return false;
      }
    },
  };
}

/**
 * Follows one page visit: where the player got to, who they played with, what
 * they did and how it ended. Games describe their state; the tracker works
 * out rounds, results and time, and reports cumulative summaries.
 */
export class SessionTracker {
  private readonly rank: Map<string, number>;
  private readonly counted?: ReadonlySet<string>;
  private environment?: TrackerEnvironment;
  private id = '';
  private origin = 0;
  private running = false;
  private closed = false;
  private seq = 0;
  private delivery = 0;
  private noisy = 0;
  private lastReport = 0;
  private dirty = false;
  private pending: WireEvent[] = [];
  private stage: Stage = 'menu';
  private stageSince = 0;
  private visibleSince: number | null = null;
  private inRoom = false;
  private room = '';
  private crew = '';
  private rounds = new Set<string>();
  private ended = new Set<string>();
  private roundKey = '';
  private autoRound = 0;
  private roundSteps = new Set<string>();
  private detach?: () => void;
  private timer?: ReturnType<typeof setInterval>;
  private firstReport?: ReturnType<typeof setTimeout>;
  private stopping?: ReturnType<typeof setTimeout>;
  private readonly summary: SessionSummary = {
    device: 'pointer',
    entry: 'direct',
    mode: '',
    room: '',
    reached: ['opened'],
    current: 'opened',
    rounds: 0,
    wins: 0,
    losses: 0,
    humans: 0,
    npcs: 0,
    elapsed: 0,
    active: 0,
    time: { menu: 0, lobby: 0, playing: 0, finished: 0 },
    actions: {},
    results: {},
    exit: '',
  };

  constructor(
    private readonly definition: GameAnalytics,
    private readonly createEnvironment: () => TrackerEnvironment = browserEnvironment,
  ) {
    this.rank = new Map(
      stepOrder(definition).map((step, index) => [step, index]),
    );
    this.counted = definition.actions
      ? new Set(Object.keys(definition.actions))
      : undefined;
  }

  /** True once the game went away and this visit was reported as left. */
  get finished() {
    return this.closed && this.summary.exit === 'left';
  }

  /** Attaches to the page lifecycle. Safe to call again after `stop`. */
  start() {
    if (!this.open() || this.running) return;
    clearTimeout(this.stopping);
    this.stopping = undefined;
    this.running = true;
    this.detach = this.environment!.listen({
      visibility: (visible) => this.visibility(visible),
      hide: () => this.close('closed'),
      show: () => this.reopen(),
    });
    if (!this.closed) this.schedule();
  }

  /** Detaches; the visit ends unless `start` follows immediately (React remounts). */
  stop() {
    if (!this.running) return;
    this.running = false;
    this.detach?.();
    this.detach = undefined;
    this.unschedule();
    this.stopping = setTimeout(() => {
      this.stopping = undefined;
      this.close('left');
    }, 0);
  }

  /** Reports now, for example right before the game navigates away. */
  flush() {
    if (this.environment && !this.closed) this.report(false);
  }

  observe(state: PlayState) {
    if (!this.open() || this.closed) return;
    if (state.stage === 'menu') {
      if (this.stage !== 'menu') {
        this.abandon('left');
        this.move('menu');
        this.record('leave');
        this.summary.current = 'opened';
      }
      this.inRoom = false;
      return;
    }
    const room = state.room ?? '';
    if (!this.inRoom || room !== this.room) this.enter(room, state.mode);
    this.headcount(state);

    const key = this.keyOf(state);
    if (state.stage === 'playing') {
      if (!this.rounds.has(key)) this.begin(key, state);
      else if (this.stage !== 'playing') {
        this.move('playing');
        this.summary.current = this.furthestOfRound();
      }
      this.reachMilestones(key, state.milestones);
    } else if (state.stage === 'finished') {
      this.reachMilestones(key, state.milestones);
      if (this.rounds.has(key) && !this.ended.has(key)) this.finish(key, state);
      this.move('finished');
    } else {
      if (this.stage === 'playing') this.abandon('abandoned');
      this.move('lobby');
      this.reach('lobby');
      this.summary.current = 'lobby';
    }
  }

  /** A milestone the game notices outside its snapshots. */
  milestone(key: string) {
    if (!this.open() || this.closed) return;
    this.reachMilestones(this.roundKey, [key]);
  }

  action(name: string) {
    if (!this.open() || this.closed) return;
    const key = toKey(name);
    if (!key || (this.counted && !this.counted.has(key))) return;
    this.count(this.summary.actions, key);
  }

  private open(): boolean {
    if (this.environment) return true;
    try {
      const environment = this.createEnvironment();
      const visit = environment.visit();
      this.environment = environment;
      this.id = environment.id();
      this.origin = environment.now();
      this.stageSince = this.origin;
      this.visibleSince = environment.visible() ? this.origin : null;
      this.summary.device = visit.device;
      this.summary.entry = visit.entry;
      this.record('opened', { device: visit.device, entry: visit.entry });
      return true;
    } catch {
      this.environment = undefined;
      return false;
    }
  }

  private now() {
    return this.environment!.now();
  }

  private enter(room: string, mode: Mode | undefined) {
    this.abandon('left');
    this.inRoom = true;
    this.room = room;
    this.crew = '';
    this.rounds.clear();
    this.ended.clear();
    this.roundKey = '';
    if (mode) {
      this.summary.mode = mode;
      this.record('mode', { mode });
    }
    this.reach('chose');
    if (this.summary.current === 'opened') this.summary.current = 'chose';
    if (mode !== 'solo' && room)
      void this.environment!.hash(
        `${this.definition.game}:${room.toUpperCase()}`,
      ).then(
        (hash) => {
          this.summary.room = hash;
          this.dirty = true;
        },
        () => {},
      );
  }

  private headcount(state: PlayState) {
    const humans = whole(state.humans, 16);
    const npcs = whole(state.npcs, 32);
    if (!humans && !npcs) return;
    this.summary.humans = Math.max(this.summary.humans, humans);
    this.summary.npcs = Math.max(this.summary.npcs, npcs);
    const crew = `${humans}:${npcs}`;
    if (crew === this.crew) return;
    this.crew = crew;
    if (this.noisy < NOISY_EVENTS) {
      this.noisy++;
      this.record('crew', { humans, npcs });
    }
  }

  private keyOf(state: PlayState) {
    if (state.round !== undefined) return `r:${String(state.round)}`;
    // Without a round identity, every return to play is a new round.
    if (state.stage === 'playing' && this.stage !== 'playing')
      return `a:${++this.autoRound}`;
    return this.roundKey || `a:${this.autoRound}`;
  }

  private begin(key: string, state: PlayState) {
    if (this.stage === 'playing') this.abandon('restarted');
    this.move('playing');
    this.rounds.add(key);
    this.roundKey = key;
    this.roundSteps.clear();
    this.summary.rounds++;
    this.reach('playing');
    if (this.summary.rounds > 1) this.reach('again');
    this.summary.current = 'playing';
    this.record('round', {
      n: this.summary.rounds,
      humans: whole(state.humans, 16),
      npcs: whole(state.npcs, 32),
    });
  }

  private reachMilestones(key: string, milestones?: readonly string[]) {
    if (!milestones?.length || key !== this.roundKey || !this.rounds.has(key))
      return;
    for (const milestone of milestones) {
      if (this.roundSteps.has(milestone) || !this.rank.has(milestone)) continue;
      this.roundSteps.add(milestone);
      this.reach(milestone);
      this.record('step', { step: milestone });
      if (this.stage === 'playing') this.summary.current = milestone;
    }
    if (this.stage === 'playing') this.summary.current = this.furthestOfRound();
  }

  private furthestOfRound() {
    let furthest = 'playing';
    for (const step of this.roundSteps)
      if (this.rank.get(step)! > this.rank.get(furthest)!) furthest = step;
    return furthest;
  }

  private finish(key: string, state: PlayState) {
    this.ended.add(key);
    const outcome = state.result?.outcome ?? 'ended';
    const reason = state.result?.reason ? toKey(state.result.reason) : '';
    this.reach('finished');
    if (outcome === 'won') {
      this.summary.wins++;
      this.reach('won');
    } else if (outcome === 'lost') this.summary.losses++;
    this.count(this.summary.results, reason ? `${outcome}:${reason}` : outcome);
    const data: EventData = { outcome };
    if (reason) data.reason = reason;
    const score = state.result?.score;
    if (typeof score === 'number' && Number.isFinite(score)) data.score = score;
    this.record('end', data);
    this.summary.current = outcome === 'won' ? 'won' : 'finished';
  }

  /** A round that stops without a result: the player left or the game called it off. */
  private abandon(reason: 'left' | 'abandoned' | 'restarted') {
    const key = this.roundKey;
    if (
      this.stage !== 'playing' ||
      !this.rounds.has(key) ||
      this.ended.has(key)
    )
      return;
    this.ended.add(key);
    this.count(this.summary.results, `ended:${reason}`);
    this.record('end', { outcome: 'ended', reason });
  }

  private reach(step: string) {
    if (!this.summary.reached.includes(step)) {
      this.summary.reached.push(step);
      this.dirty = true;
    }
  }

  private move(stage: Stage) {
    if (stage === this.stage) return;
    this.account();
    this.stage = stage;
    this.dirty = true;
  }

  private count(counts: Record<string, number>, key: string) {
    if (!(key in counts) && Object.keys(counts).length >= MAX_COUNTED_KINDS)
      return;
    counts[key] = (counts[key] ?? 0) + 1;
    this.dirty = true;
  }

  private record(type: EventType, data?: EventData) {
    this.dirty = true;
    if (this.seq >= MAX_SESSION_EVENTS) return;
    this.pending.push({
      seq: this.seq++,
      at: Math.round(this.now() - this.origin),
      type,
      ...(data ? { data } : {}),
    });
  }

  private account() {
    const now = this.now();
    this.summary.time[this.stage] += Math.max(0, now - this.stageSince);
    this.stageSince = now;
    if (this.visibleSince !== null) {
      this.summary.active += Math.max(0, now - this.visibleSince);
      this.visibleSince = now;
    }
    this.summary.elapsed = Math.max(this.summary.elapsed, now - this.origin);
  }

  private visibility(visible: boolean) {
    if (this.closed || visible === (this.visibleSince !== null)) return;
    this.account();
    this.visibleSince = visible ? this.now() : null;
    if (this.noisy < NOISY_EVENTS) {
      this.noisy++;
      this.record(visible ? 'visible' : 'hidden');
    }
    // A hidden page may be discarded without another chance to report.
    if (!visible) this.report(false);
  }

  private close(exit: Exit) {
    if (this.closed || !this.environment) return;
    this.abandon('left');
    this.account();
    this.summary.exit = exit;
    this.record('exit', { how: exit });
    this.closed = true;
    this.unschedule();
    this.report(true);
  }

  /** The browser restored the page from its back-forward cache. */
  private reopen() {
    if (!this.closed) return;
    this.closed = false;
    this.summary.exit = '';
    this.stageSince = this.now();
    this.visibleSince = this.environment!.visible() ? this.now() : null;
    this.record('return');
    if (this.running) this.schedule();
  }

  private schedule() {
    this.unschedule();
    this.timer = setInterval(() => this.tick(), TICK_MS);
    if (!this.delivery)
      this.firstReport = setTimeout(() => this.report(false), FIRST_REPORT_MS);
  }

  private unschedule() {
    clearInterval(this.timer);
    clearTimeout(this.firstReport);
    this.timer = undefined;
    this.firstReport = undefined;
  }

  private tick() {
    if (this.closed) return;
    const since = this.now() - this.lastReport;
    if (
      this.pending.length >= 20 ||
      (this.dirty && since >= REPORT_MS) ||
      (this.visibleSince !== null && since >= KEEPALIVE_MS)
    )
      this.report(false);
  }

  private report(final: boolean) {
    const environment = this.environment!;
    clearTimeout(this.firstReport);
    this.account();
    this.lastReport = this.now();
    this.dirty = false;
    const delivery = ++this.delivery;
    let events = this.pending.slice(0, MAX_BATCH_EVENTS);
    let body = this.encode(delivery, events);
    while (body.length > MAX_BATCH_BYTES && events.length) {
      events = events.slice(0, events.length >> 1);
      body = this.encode(delivery, events);
    }
    const sent = new Set(events.map((event) => event.seq));
    void environment.send(body, final).then(
      (delivered) => {
        if (delivered)
          this.pending = this.pending.filter((event) => !sent.has(event.seq));
        else this.dirty = true;
      },
      () => {
        this.dirty = true;
      },
    );
  }

  private encode(delivery: number, events: WireEvent[]) {
    const { time } = this.summary;
    const batch: Batch = {
      v: ANALYTICS_VERSION,
      id: this.id,
      game: this.definition.game,
      b: delivery,
      summary: {
        ...this.summary,
        reached: [...this.summary.reached],
        elapsed: Math.round(this.summary.elapsed),
        active: Math.round(this.summary.active),
        time: {
          menu: Math.round(time.menu),
          lobby: Math.round(time.lobby),
          playing: Math.round(time.playing),
          finished: Math.round(time.finished),
        },
      },
      events,
    };
    return JSON.stringify(batch);
  }
}

function whole(value: number | undefined, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(max, Math.round(value)))
    : 0;
}
