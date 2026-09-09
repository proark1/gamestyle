import { farmMove, FARMER_SPEED } from './movement';
import { coverBlocks } from './visibility';
import { farmMode, type FarmSnapshot, type Point } from './types';

type Pose = Point & { angle: number };
const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));
const turn = (from: number, to: number, t: number) =>
  from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * t;
const blend = (a: Pose, b: Pose, t: number): Pose => ({
  x: a.x + (b.x - a.x) * t,
  z: a.z + (b.z - a.z) * t,
  angle: turn(a.angle, b.angle, t),
});

/** Local motor plus bounded reconciliation; other actors share one interpolation clock. */
export class FarmMotion {
  farmer: Pose = { x: 0, z: -3, angle: 0 };
  private samples: FarmSnapshot[] = [];
  private receivedAt = 0;
  private cursor = 0;
  private interval = 100;
  private first = true;
  private lastInput: Point = { x: 0, z: 0 };
  private changedAt = 0;
  private a?: FarmSnapshot;
  private b?: FarmSnapshot;
  private t = 1;

  push(s: FarmSnapshot, now: number) {
    const previous = this.samples.at(-1);
    const reset =
      !previous ||
      s.code !== previous.code ||
      s.you.id !== previous.you.id ||
      s.world.round !== previous.world.round ||
      s.world.phase !== previous.world.phase ||
      now - this.receivedAt > 1200;
    if (reset) {
      this.samples = [];
      this.farmer = { ...s.world.farmer };
      this.cursor = s.world.clock - 100;
      this.first = false;
    } else if (previous && s.world.clock > previous.world.clock) {
      this.interval +=
        (clamp(s.world.clock - previous.world.clock, 40, 200) - this.interval) *
        0.15;
    }
    if (!previous || reset || s.world.clock >= previous.world.clock) {
      if (this.samples.at(-1)?.world.clock === s.world.clock)
        this.samples.pop();
      this.samples.push(s);
      this.samples = this.samples.slice(-12);
      this.receivedAt = now;
    }
  }

  frame(now: number, dt: number, input: Point, paused: boolean) {
    const s = this.samples.at(-1);
    if (!s || this.first) return this.farmer;
    const delay = clamp(this.interval * 1.2, 80, 200);
    this.cursor = Math.min(
      s.world.clock,
      this.cursor +
        dt *
          1000 *
          clamp(1 + (s.world.clock - this.cursor - delay) / 250, 0.85, 1.15),
    );
    while (
      this.samples.length > 2 &&
      this.samples[1].world.clock <= this.cursor
    )
      this.samples.shift();
    this.a = this.samples[0];
    this.b = this.samples[1] ?? this.a;
    this.t =
      this.a.world.clock === this.b.world.clock
        ? 1
        : clamp(
            (this.cursor - this.a.world.clock) /
              (this.b.world.clock - this.a.world.clock),
            0,
            1,
          );
    if (s.you.role !== 'farmer' || s.world.phase !== 'playing') {
      this.farmer = blend(this.a.world.farmer, this.b.world.farmer, this.t);
      return this.farmer;
    }
    const controls = paused ? { x: 0, z: 0 } : input;
    if (controls.x !== this.lastInput.x || controls.z !== this.lastInput.z) {
      this.lastInput = { ...controls };
      this.changedAt = now;
    }
    const solid = farmMode(s.world) === 'human';
    const previousAngle = this.farmer.angle;
    const fresh = now - this.receivedAt < 500;
    if (fresh) farmMove(this.farmer, controls, FARMER_SPEED, dt, solid);
    this.farmer.angle = turn(
      previousAngle,
      this.farmer.angle,
      1 - Math.exp(-dt * 24),
    );
    const confirmed = s.you.motion;
    const pending =
      confirmed && (confirmed.x !== controls.x || confirmed.z !== controls.z);
    // A just-pressed key is intentionally ahead of the server. Don't pull it back.
    if (pending && fresh && now - this.changedAt < 400) return this.farmer;
    const target = { ...s.world.farmer };
    const lead =
      fresh && !paused
        ? clamp(now - this.receivedAt + (s.latencyMs ?? 0), 0, 250) / 1000
        : 0;
    if (confirmed && lead > 0) {
      const steps = Math.max(1, Math.ceil(lead / 0.025));
      for (let i = 0; i < steps; i++)
        farmMove(target, confirmed, FARMER_SPEED, lead / steps, solid);
    }
    const dx = target.x - this.farmer.x,
      dz = target.z - this.farmer.z;
    if (Math.hypot(dx, dz) > 3) this.farmer = target;
    else if (Math.hypot(dx, dz) > 0.025) {
      const amount = Math.min(
        1 - Math.exp(-dt * 8),
        (dt * 1.5) / Math.max(0.001, Math.hypot(dx, dz)),
      );
      const x = this.farmer.x + dx * amount,
        z = this.farmer.z + dz * amount;
      if (!solid || !coverBlocks({ x, z: this.farmer.z })) this.farmer.x = x;
      if (!solid || !coverBlocks({ x: this.farmer.x, z })) this.farmer.z = z;
    }
    return this.farmer;
  }

  cow(current: Pose & { id: string }) {
    const a = this.a?.world.cows.find((c) => c.id === current.id);
    const b = this.b?.world.cows.find((c) => c.id === current.id);
    return a && b ? blend(a, b, this.t) : current;
  }
}
