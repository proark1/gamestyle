import { Quaternion } from 'three';
import { clamp } from '../../shared/math/clamp';
import type { LoadSnapshot, Part, Piano, Wrecker } from './types';

export type Pose = { x: number; y: number; z: number; quaternion: Quaternion };
export const emptyPose = (): Pose => ({
  x: 0,
  y: 0,
  z: 0,
  quaternion: new Quaternion(),
});
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const rotation = (part: Part, out = new Quaternion()) =>
  part.quaternion
    ? out.set(
        part.quaternion.x,
        part.quaternion.y,
        part.quaternion.z,
        part.quaternion.w,
      )
    : out.set(0, 0, 0, 1);

/**
 * Render the site on a short buffered timeline rather than straight from
 * whichever snapshot last arrived. Debris and remote crew then move smoothly
 * regardless of when the host's updates land.
 */
export class SiteMotion {
  samples: LoadSnapshot[] = [];
  cursor = 0;
  lastFrame = 0;
  interval = 150;
  private spare = new Quaternion();

  clear() {
    this.samples = [];
    this.cursor = 0;
    this.lastFrame = 0;
    this.interval = 150;
  }

  push(snapshot: LoadSnapshot, now: number) {
    const last = this.samples.at(-1);
    // A new job resets the world outright; do not tween across the cut.
    if (last && last.world.started !== snapshot.world.started) this.clear();
    const previous = this.samples.at(-1);
    if (previous && snapshot.world.clock <= previous.world.clock) return;
    if (previous)
      this.interval = mix(
        this.interval,
        clamp(snapshot.world.clock - previous.world.clock, 50, 400),
        0.2,
      );
    this.samples.push(snapshot);
    if (this.samples.length === 1) {
      this.cursor = snapshot.world.clock;
      this.lastFrame = now;
    }
    if (this.samples.length > 20) this.samples.shift();
  }

  advance(now: number) {
    const latest = this.samples.at(-1);
    if (!latest) return;
    const dt = clamp(now - this.lastFrame, 0, 100);
    this.lastFrame = now;
    const lag = latest.world.clock - this.cursor;
    const delay = clamp(this.interval * 1.35, 100, 450);
    this.cursor = Math.min(
      latest.world.clock,
      this.cursor + dt * clamp(1 + (lag - delay) / 300, 0.8, 1.2),
    );
    while (this.samples.length > 2 && this.samples[1].world.clock < this.cursor)
      this.samples.shift();
  }

  pair() {
    const first = this.samples[0];
    const last =
      this.samples.find((s) => s.world.clock >= this.cursor) ??
      this.samples.at(-1);
    if (!first || !last) return null;
    let before = first;
    for (const sample of this.samples) {
      if (sample.world.clock > this.cursor) break;
      before = sample;
    }
    const span = last.world.clock - before.world.clock;
    const t = span <= 0 ? 1 : clamp((this.cursor - before.world.clock) / span, 0, 1);
    return { a: before, b: last, t };
  }

  /** Interpolated pose for a part, holding still through a state change. */
  part(current: Part, out: Pose) {
    const pair = this.pair();
    let a = current;
    let b = current;
    let t = 1;
    if (pair) {
      const first = pair.a.world.parts.find((p) => p.id === current.id);
      const second = pair.b.world.parts.find((p) => p.id === current.id);
      // Losing support is a discrete event. Tweening across it would drag a
      // part backwards into the pose it held while it was still standing.
      if (
        first &&
        second &&
        first.falling === current.falling &&
        second.falling === current.falling &&
        first.hits === current.hits &&
        second.hits === current.hits
      ) {
        a = first;
        b = second;
        t = pair.t;
      }
    }
    out.x = mix(a.x, b.x, t);
    out.y = mix(a.y, b.y, t);
    out.z = mix(a.z, b.z, t);
    rotation(a, out.quaternion).slerp(rotation(b, this.spare), t);
    return out;
  }

  player(current: Wrecker) {
    const pair = this.pair();
    if (!pair) return current;
    const a = pair.a.world.players.find((p) => p.id === current.id);
    const b = pair.b.world.players.find((p) => p.id === current.id);
    if (!a || !b || a.down !== current.down) return current;
    const facing =
      a.facing +
      Math.atan2(Math.sin(b.facing - a.facing), Math.cos(b.facing - a.facing)) *
        pair.t;
    return {
      ...current,
      x: mix(a.x, b.x, pair.t),
      y: mix(a.y, b.y, pair.t),
      z: mix(a.z, b.z, pair.t),
      facing,
    };
  }

  piano(current: Piano) {
    const pair = this.pair();
    if (!pair) return current;
    const a = pair.a.world.piano;
    const b = pair.b.world.piano;
    if (a.resting !== current.resting || b.resting !== current.resting)
      return current;
    return {
      ...current,
      x: mix(a.x, b.x, pair.t),
      y: mix(a.y, b.y, pair.t),
      z: mix(a.z, b.z, pair.t),
    };
  }

  ball(current: { x: number; y: number; z: number }) {
    const pair = this.pair();
    if (!pair) return current;
    const a = pair.a.world.crane;
    const b = pair.b.world.crane;
    if (!pair.a.world.crane.owner || !pair.b.world.crane.owner) return current;
    return {
      x: mix(a.ballX, b.ballX, pair.t),
      y: mix(a.ballY, b.ballY, pair.t),
      z: mix(a.ballZ, b.ballZ, pair.t),
    };
  }
}

/** Network corrections must not shove an avatar after controls are released. */
export class WreckerCorrection {
  x = 0;
  z = 0;
  receive(predicted: Wrecker, server: Wrecker) {
    this.x = server.x - predicted.x;
    this.z = server.z - predicted.z;
    if (Math.hypot(this.x, this.z) > 1.8) {
      Object.assign(predicted, structuredClone(server));
      this.x = this.z = 0;
      return;
    }
    if (Math.abs(predicted.y - server.y) > 1.2) {
      predicted.y = server.y;
      predicted.vy = server.vy;
      predicted.grounded = server.grounded;
    }
    predicted.down = server.down;
    predicted.downUntil = server.downUntil;
  }
  apply(player: Wrecker, moving: boolean, dt: number) {
    if (!moving) {
      this.x = this.z = 0;
      return;
    }
    // Tolerate ordinary prediction lead; resolve larger errors continuously
    // rather than jerking the avatar and follow camera on packet arrival.
    if (Math.hypot(this.x, this.z) < 0.45) return;
    const t = 1 - Math.exp(-dt * 3);
    const x = this.x * t;
    const z = this.z * t;
    player.x += x;
    player.z += z;
    this.x -= x;
    this.z -= z;
  }
}
