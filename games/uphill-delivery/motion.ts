import { Quaternion, Vector3 } from 'three';
import type { DeliveryPlayer, DeliverySnapshot } from './types';

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const stamp = (s: DeliverySnapshot) => s.world.clock - s.world.remainder * 1000;
type Sample = { snapshot: DeliverySnapshot; time: number };

/** One continuous presentation clock keeps cargo, hands, bridges and camera together. */
export class DeliveryMotion {
  samples: Sample[] = [];
  cursor = 0;
  interval = 90;
  lastFrame = 0;
  local = false;
  a?: DeliverySnapshot;
  b?: DeliverySnapshot;
  t = 1;
  private rotation = new Quaternion();

  push(snapshot: DeliverySnapshot, now: number) {
    const last = this.samples.at(-1);
    if (
      !last ||
      last.snapshot.code !== snapshot.code ||
      last.snapshot.world.started !== snapshot.world.started ||
      last.snapshot.world.phase !== snapshot.world.phase ||
      stamp(snapshot) - last.time > 750
    ) {
      this.samples = [];
      this.local = snapshot.code === 'PRACTICE';
      this.interval = 90;
      this.cursor = stamp(snapshot) - (this.local ? 0 : this.interval);
      this.lastFrame = now;
    }
    const previous = this.samples.at(-1),
      time = stamp(snapshot);
    if (previous && time < previous.time) return;
    if (previous?.time === time) previous.snapshot = snapshot;
    else {
      if (previous && !this.local)
        this.interval = mix(
          this.interval,
          clamp(time - previous.time, 40, 250),
          0.15,
        );
      this.samples.push({ snapshot, time });
    }
    if (this.samples.length > 40) this.samples.shift();
  }

  advance(now: number) {
    const latest = this.samples.at(-1);
    if (!latest) return;
    const dt = clamp(now - this.lastFrame, 0, 100);
    this.lastFrame = now;
    if (this.local) {
      // Fixed-step interpolation also stays smooth on 90/120/144 Hz screens.
      this.cursor = latest.snapshot.world.clock - 1000 / 60;
    } else {
      const delay = clamp(this.interval * 1.2, 80, 180);
      const lag = latest.time - this.cursor;
      this.cursor = Math.min(
        latest.time,
        this.cursor + dt * clamp(1 + (lag - delay) / 250, 0.85, 1.15),
      );
    }
    while (this.samples.length > 2 && this.samples[1].time <= this.cursor)
      this.samples.shift();
    const a = this.samples[0],
      b = this.samples[1] ?? a;
    this.a = a.snapshot;
    this.b = b.snapshot;
    this.t =
      a.time === b.time
        ? 1
        : clamp((this.cursor - a.time) / (b.time - a.time), 0, 1);
  }

  sofa(current: DeliverySnapshot, position: Vector3, quaternion: Quaternion) {
    const a = (this.a ?? current).world.sofa,
      b = (this.b ?? current).world.sofa;
    position.set(
      mix(a.x, b.x, this.t),
      mix(a.y, b.y, this.t),
      mix(a.z, b.z, this.t),
    );
    quaternion
      .set(a.quaternion.x, a.quaternion.y, a.quaternion.z, a.quaternion.w)
      .slerp(
        this.rotation.set(
          b.quaternion.x,
          b.quaternion.y,
          b.quaternion.z,
          b.quaternion.w,
        ),
        this.t,
      );
  }

  player(current: DeliveryPlayer, position: Vector3) {
    const a = this.a?.world.players.find((p) => p.id === current.id) ?? current;
    const b = this.b?.world.players.find((p) => p.id === current.id) ?? current;
    position.set(
      mix(a.x, b.x, this.t),
      mix(a.y, b.y, this.t),
      mix(a.z, b.z, this.t),
    );
    return (
      a.angle +
      Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle)) *
        this.t
    );
  }

  panel(current: DeliverySnapshot, key: 'gate' | 'door') {
    return mix(
      (this.a ?? current).world[key],
      (this.b ?? current).world[key],
      this.t,
    );
  }
}

/** Sustained slow frames lower fill cost; brief stalls never change image quality. */
export class DeliveryQuality {
  level = 0;
  private elapsed = 0;
  private frames = 0;
  private slow = 0;
  private cooldown = 5000;
  record(gap: number): boolean {
    if (gap <= 0 || gap > 250) return false;
    if (this.cooldown > 0) {
      this.cooldown -= gap;
      return false;
    }
    this.elapsed += gap;
    this.frames++;
    if (gap > 22) this.slow++;
    if (this.elapsed < 3000) return false;
    const change = this.slow / this.frames > 0.2 && this.level < 2;
    this.elapsed = this.frames = this.slow = 0;
    if (change) {
      this.level++;
      this.cooldown = 5000;
    }
    return change;
  }
}
