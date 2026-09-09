import { Quaternion } from 'three';
import { clamp } from '../../shared/math/clamp';
import { type Piece, type Player, type Snapshot } from './types';

type Pose = { x: number; y: number; z: number; quaternion: Quaternion };
const rotation = (piece: Piece) =>
  piece.quaternion && !piece.heldBy
    ? new Quaternion(
        piece.quaternion.x,
        piece.quaternion.y,
        piece.quaternion.z,
        piece.quaternion.w,
      )
    : new Quaternion(
        0,
        Math.sin((piece.rotation * Math.PI) / 4),
        0,
        Math.cos((piece.rotation * Math.PI) / 4),
      );
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** Render remote physics on a short buffered timeline, independent of HTTP arrival. */
export class SnapshotMotion {
  samples: Snapshot[] = [];
  cursor = 0;
  lastFrame = 0;
  interval = 150;
  clear() {
    this.samples = [];
    this.cursor = 0;
    this.lastFrame = 0;
    this.interval = 150;
  }
  push(snapshot: Snapshot, now: number) {
    const last = this.samples.at(-1);
    if (last && last.world.started !== snapshot.world.started) this.clear();
    const previous = this.samples.at(-1);
    if (previous && snapshot.world.clock <= previous.world.clock) return;
    if (previous)
      this.interval = mix(
        this.interval,
        clamp(snapshot.world.clock - previous.world.clock, 50, 400),
        0.2,
      );
    if (previous) {
      const changed = new Map<string, Piece>();
      for (const piece of snapshot.world.pieces) {
        const before = previous.world.pieces.find((p) => p.id === piece.id);
        if (
          before &&
          (before.kind !== piece.kind ||
            before.revision !== piece.revision ||
            before.heldBy !== piece.heldBy)
        )
          changed.set(piece.id, piece);
      }
      // Begin a fresh trajectory at the committed action pose. Keeping old
      // ownership samples would freeze, then rewind a newly dropped load.
      if (changed.size)
        this.samples = this.samples.map((s) => ({
          ...s,
          world: {
            ...s.world,
            pieces: s.world.pieces.map((p) => changed.get(p.id) ?? p),
          },
        }));
    }
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
    const lag = latest.world.clock - this.cursor,
      delay = clamp(this.interval * 1.35, 100, 450);
    // Adjust playback speed gently; never move the timeline backwards.
    this.cursor = Math.min(
      latest.world.clock,
      this.cursor + dt * clamp(1 + (lag - delay) / 300, 0.8, 1.2),
    );
    while (this.samples.length > 2 && this.samples[1].world.clock < this.cursor)
      this.samples.shift();
  }
  pair() {
    const a = this.samples[0],
      b =
        this.samples.find((s) => s.world.clock >= this.cursor) ??
        this.samples.at(-1);
    if (!a || !b) return null;
    let before = a;
    for (const sample of this.samples) {
      if (sample.world.clock > this.cursor) break;
      before = sample;
    }
    const t =
      b.world.clock === before.world.clock
        ? 1
        : clamp(
            (this.cursor - before.world.clock) /
              (b.world.clock - before.world.clock),
            0,
            1,
          );
    return { a: before, b, t };
  }
  piece(current: Piece, out: Pose) {
    const pair = this.pair();
    let a = current,
      b = current,
      t = 1;
    if (pair) {
      const first = pair.a.world.pieces.find((p) => p.id === current.id),
        second = pair.b.world.pieces.find((p) => p.id === current.id);
      // A grab/place/rotation is an explicit action. Do not interpolate through
      // another object while catching up with an older ownership or pose.
      if (
        first &&
        second &&
        first.kind === current.kind &&
        second.kind === current.kind &&
        first.heldBy === current.heldBy &&
        second.heldBy === current.heldBy &&
        first.revision === current.revision &&
        second.revision === current.revision
      ) {
        a = first;
        b = second;
        t = pair.t;
      }
    }
    out.x = mix(a.x, b.x, t);
    out.y = mix(a.y, b.y, t);
    out.z = mix(a.z, b.z, t);
    out.quaternion.copy(rotation(a)).slerp(rotation(b), t);
    return out;
  }
  player(current: Player) {
    const pair = this.pair();
    if (!pair) return current;
    const a = pair.a.world.players.find((p) => p.id === current.id),
      b = pair.b.world.players.find((p) => p.id === current.id);
    if (!a || !b || a.down !== current.down || a.rescued !== current.rescued)
      return current;
    const angle =
      a.angle +
      Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle)) *
        pair.t;
    return {
      ...current,
      x: mix(a.x, b.x, pair.t),
      y: mix(a.y, b.y, pair.t),
      z: mix(a.z, b.z, pair.t),
      angle,
    };
  }
}

/** Small network corrections must not move an avatar after controls are released. */
export class PlayerCorrection {
  x = 0;
  z = 0;
  receive(predicted: Player, server: Player) {
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
    predicted.rescued = server.rescued;
    predicted.breath = server.breath;
  }
  apply(player: Player, moving: boolean, dt: number) {
    if (!moving) {
      this.x = this.z = 0;
      return;
    }
    // Tolerate ordinary prediction lead. Resolve larger errors continuously,
    // rather than jerking the character and follow-camera on packet arrival.
    if (Math.hypot(this.x, this.z) < 0.45) return;
    const t = 1 - Math.exp(-dt * 3),
      x = this.x * t,
      z = this.z * t;
    player.x += x;
    player.z += z;
    this.x -= x;
    this.z -= z;
  }
}
