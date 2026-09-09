import { clearSight, move, RADIUS } from './layout';
import {
  GUARD_SPEED,
  LADDER_SPEED,
  WALK_SPEED,
  idleInput,
  type Body,
  type Input,
  type Snapshot,
  type SnapshotTiming,
} from './types';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const angleMix = (a: number, b: number, t: number) =>
  a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
type TimedInput = { at: number; input: Input };
type Sample = { snapshot: Snapshot; at: number };
export type RenderBody = Body & { moving: boolean };

/** Presentation only: only the server chooses visible actors and applies actions. */
export class ShelfMotion {
  private snapshot?: Snapshot;
  private receivedAt = 0;
  private lastFrame = 0;
  private inputs: TimedInput[] = [];
  private input = idleInput();
  private predicted: Body | null = null;
  private correction = { x: 0, z: 0 };
  private samples: Sample[] = [];
  private cursor = 0;
  private interval = 120;
  private jitter = 0;
  private a?: Snapshot;
  private b?: Snapshot;
  private blend = 1;
  private moving = false;

  setInput(input: Input, now: number) {
    if (
      input.seq === this.input.seq &&
      input.x === this.input.x &&
      input.z === this.input.z
    )
      return;
    if (this.snapshot && now > this.lastFrame) this.advance(now);
    this.input = { ...input };
    this.inputs.push({ at: now, input: this.input });
    while (this.inputs.length > 1 && this.inputs[1].at < now - 2000)
      this.inputs.shift();
  }

  push(snapshot: Snapshot, now: number, timing?: SnapshotTiming) {
    const previous = this.snapshot;
    if (
      previous &&
      snapshot.version < previous.version &&
      snapshot.code === previous.code
    )
      return;
    // Account for the fraction of a frame before the reply arrived, once.
    if (previous && this.predicted && now > this.lastFrame) this.advance(now);
    const reset =
      !previous ||
      previous.code !== snapshot.code ||
      previous.round !== snapshot.round ||
      previous.you.role !== snapshot.you.role ||
      previous.you.status !== snapshot.you.status ||
      !this.predicted ||
      now - this.receivedAt > 750;
    this.snapshot = snapshot;
    this.receivedAt = now;
    if (reset) {
      this.samples = [];
      this.interval = 120;
      this.jitter = 0;
      this.cursor = snapshot.clock - 150;
      this.lastFrame = now;
      this.predicted = snapshot.you.body ? { ...snapshot.you.body } : null;
      this.correction = { x: 0, z: 0 };
      this.moving = false;
    }
    const last = this.samples.at(-1);
    if (!last || snapshot.clock > last.snapshot.clock) {
      if (last) {
        const interval = snapshot.clock - last.snapshot.clock;
        // Action replies can arrive between movement updates; don't shrink the buffer for them.
        if (interval >= 35) {
          this.jitter = mix(
            this.jitter,
            Math.abs(interval - this.interval),
            0.15,
          );
          this.interval = mix(this.interval, clamp(interval, 40, 300), 0.15);
        }
      }
      this.samples.push({ snapshot, at: now });
    } else if (snapshot.clock === last.snapshot.clock) last.snapshot = snapshot;
    while (this.samples.length > 32) this.samples.shift();

    if (!snapshot.you.body) {
      this.predicted = null;
      return;
    }
    const authoritative = { ...snapshot.you.body };
    // A request's snapshot precedes applying its input. Replay the in-flight input
    // and any newer local changes, bounded so a disconnected client cannot wander.
    const start = timing ? Math.max(timing.sentAt, now - 300) : now;
    let at = start;
    let input = snapshot.you.input ?? timing?.input ?? idleInput();
    for (const change of this.inputs) {
      if (
        change.at <= start ||
        change.at > now ||
        change.input.seq <= (snapshot.you.input?.seq ?? timing?.input.seq ?? -1)
      )
        continue;
      this.step(authoritative, input, (change.at - at) / 1000, now);
      input = change.input;
      at = change.at;
    }
    this.step(authoritative, input, (now - at) / 1000, now);
    if (
      !this.predicted ||
      reset ||
      Math.hypot(
        authoritative.x - this.predicted.x,
        authoritative.z - this.predicted.z,
      ) > 2.5
    ) {
      this.predicted = authoritative;
      this.correction = { x: 0, z: 0 };
    } else {
      this.correction = {
        x: authoritative.x - this.predicted.x,
        z: authoritative.z - this.predicted.z,
      };
    }
  }

  private canMove(now: number) {
    const s = this.snapshot;
    return (
      !!s &&
      s.you.status === 'active' &&
      (s.phase === 'playing' ||
        (s.phase === 'hiding' && s.you.role === 'mannequin')) &&
      now - this.receivedAt <= 750 &&
      now - this.receivedAt >= (s.you.stunnedFor ?? 0)
    );
  }

  private step(body: Body, input: Input, seconds: number, now: number) {
    if (!this.canMove(now) || seconds <= 0) return;
    const speed =
      this.snapshot!.you.role === 'guard'
        ? GUARD_SPEED
        : this.snapshot!.you.carrying === 'ladder'
          ? LADDER_SPEED
          : WALK_SPEED;
    const steps = Math.max(1, Math.ceil(seconds / 0.02));
    for (let i = 0; i < steps; i++) move(body, input, speed, seconds / steps);
  }

  advance(now: number, paused = false) {
    const dt = clamp((now - this.lastFrame) / 1000, 0, 0.05);
    this.lastFrame = now;
    const body = this.predicted;
    if (dt > 0) this.moving = false;
    if (body) {
      const x = body.x,
        z = body.z;
      if (!paused) this.step(body, this.input, dt, now);
      if (dt > 0) this.moving = Math.hypot(body.x - x, body.z - z) > dt * 0.1;
      const factor = 1 - Math.exp(-dt / 0.12);
      const dx = this.correction.x * factor,
        dz = this.correction.z * factor;
      // Reconciliation never tunnels through a shelf or changes the facing direction.
      const target = { x: body.x + dx, z: body.z + dz };
      if (clearSight(body, target, RADIUS)) {
        const angle = body.angle;
        const distance = Math.hypot(dx, dz);
        if (distance > 0.00001)
          move(body, { x: dx / distance, z: dz / distance }, distance, 1);
        body.angle = angle;
      }
      this.correction.x -= dx;
      this.correction.z -= dz;
    }
    const latest = this.samples.at(-1);
    if (!latest) return;
    const delay = clamp(this.interval * 1.25 + this.jitter, 100, 320);
    const lag = latest.snapshot.clock - this.cursor;
    this.cursor = Math.min(
      latest.snapshot.clock,
      this.cursor + dt * 1000 * clamp(1 + (lag - delay) / 500, 0.9, 1.1),
    );
    while (
      this.samples.length > 2 &&
      this.samples[1].snapshot.clock <= this.cursor
    )
      this.samples.shift();
    const a = this.samples[0].snapshot,
      b = this.samples[1]?.snapshot ?? a;
    this.a = a;
    this.b = b;
    this.blend =
      a.clock === b.clock
        ? 1
        : clamp((this.cursor - a.clock) / (b.clock - a.clock), 0, 1);
  }

  own(): RenderBody | null {
    return this.predicted ? { ...this.predicted, moving: this.moving } : null;
  }

  actor(id: string): RenderBody | null {
    const s = this.snapshot;
    if (!s) return null;
    // Never keep rendering an actor removed from the newest private snapshot.
    const get = (snapshot?: Snapshot) =>
      id === 'guard'
        ? snapshot?.guard
        : snapshot?.figures.find((f) => f.id === id);
    const current = get(s);
    if (!current) return null;
    if ((id === 'guard' && s.you.role === 'guard') || id === s.you.figureId)
      return this.own();
    const a = get(this.a) ?? current,
      b = get(this.b) ?? current;
    const t = this.blend;
    let x = mix(a.x, b.x, t),
      z = mix(a.z, b.z, t);
    if (!clearSight(a, b, RADIUS)) {
      // Respect an L-shaped path around a corner instead of cutting through it.
      const corners = [
        { x: b.x, z: a.z },
        { x: a.x, z: b.z },
      ];
      const corner = corners.find(
        (p) => clearSight(a, p, RADIUS) && clearSight(p, b, RADIUS),
      );
      if (corner) {
        const first = Math.hypot(corner.x - a.x, corner.z - a.z);
        const second = Math.hypot(b.x - corner.x, b.z - corner.z);
        const travel = (first + second) * t;
        const from = travel <= first ? a : corner,
          to = travel <= first ? corner : b;
        const fraction =
          travel <= first
            ? travel / Math.max(first, 0.001)
            : (travel - first) / Math.max(second, 0.001);
        x = mix(from.x, to.x, fraction);
        z = mix(from.z, to.z, fraction);
      } else {
        x = b.x;
        z = b.z;
      }
    }
    return {
      x,
      z,
      angle: angleMix(a.angle, b.angle, t),
      moving: t < 1 && Math.hypot(b.x - a.x, b.z - a.z) > 0.005,
    };
  }
}
