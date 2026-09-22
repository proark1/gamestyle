import type { GameSnapshot } from './engine';
type Path = (string | number)[];
type Change = [Path, unknown];
// Sub-millimetre visual transforms need no double-precision text on the wire.
// Authoritative simulation and recovery checkpoints retain their full precision.
const transforms = new Set([
  'x',
  'y',
  'z',
  'w',
  'vx',
  'vy',
  'vz',
  'angle',
  'yaw',
  'pitch',
  'rotation',
  'hookX',
  'hookY',
  'hookZ',
  'hookVx',
  'hookVy',
  'hookVz',
  'trolleyX',
  'trolleyZ',
  'trolleyDist',
  'cableLength',
]);
export function snapshotJson(snapshot: GameSnapshot) {
  return JSON.stringify(snapshot, (key, value) =>
    transforms.has(key) &&
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) < 1e12
      ? Math.round(value * 10000) / 10000
      : value,
  );
}
export type StatePacket =
  | { type: 'baseline'; snapshot: GameSnapshot }
  | { type: 'snapshot'; snapshot: GameSnapshot }
  | {
      type: 'snapshot-delta';
      base: number;
      version: number;
      changes: Change[];
    };
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object';
function diff(base: unknown, next: unknown, path: Path, changes: Change[]) {
  if (base === next) return;
  if (
    object(base) &&
    object(next) &&
    Array.isArray(base) === Array.isArray(next)
  ) {
    const a = Object.keys(base),
      b = Object.keys(next);
    if (a.length === b.length && a.every((key) => Object.hasOwn(next, key))) {
      const nested: Change[] = [];
      for (const key of b)
        diff(
          base[key],
          next[key],
          [...path, Array.isArray(next) ? Number(key) : key],
          nested,
        );
      // Replacing a densely changing object costs less than repeating long paths.
      const replacement: Change = [path, next];
      if (
        nested.length > 1 &&
        JSON.stringify(nested).length > JSON.stringify([replacement]).length
      )
        changes.push(replacement);
      else changes.push(...nested);
      return;
    }
  }
  changes.push([path, next]);
}
/** A separate codec belongs to each recipient, so private snapshots never share a baseline. */
export class SnapshotSender {
  private base?: GameSnapshot;
  private at = 0;
  reset() {
    this.base = undefined;
  }
  encode(snapshot: GameSnapshot, now: number): StatePacket {
    const json = snapshotJson(snapshot);
    snapshot = JSON.parse(json) as GameSnapshot;
    if (!this.base || now - this.at >= 2000) {
      this.base = snapshot;
      this.at = now;
      return { type: 'baseline', snapshot };
    }
    const changes: Change[] = [];
    diff(this.base, snapshot, [], changes);
    const delta: StatePacket = {
      type: 'snapshot-delta',
      base: this.base.version,
      version: snapshot.version,
      changes,
    };
    if (JSON.stringify(delta).length > json.length * 0.85) {
      return { type: 'snapshot', snapshot };
    }
    return delta;
  }
}
export class SnapshotReceiver {
  private bases = new Map<number, GameSnapshot>();
  reset() {
    this.bases.clear();
  }
  decode(packet: StatePacket): GameSnapshot | null {
    if (packet.type === 'snapshot') return packet.snapshot;
    if (packet.type === 'baseline') {
      const snap = packet.snapshot;
      if (
        !snap ||
        !Number.isSafeInteger(snap.version) ||
        !Array.isArray(snap.world?.players)
      )
        return null;
      this.bases.set(snap.version, structuredClone(snap));
      while (this.bases.size > 2)
        this.bases.delete(this.bases.keys().next().value!);
      return snap;
    }
    const base = this.bases.get(packet.base);
    if (
      !base ||
      !Number.isSafeInteger(packet.version) ||
      !Array.isArray(packet.changes) ||
      packet.changes.length > 10000
    )
      return null;
    let next: unknown = structuredClone(base);
    for (const entry of packet.changes) {
      if (!Array.isArray(entry) || entry.length !== 2) return null;
      const [path, value] = entry;
      if (
        !Array.isArray(path) ||
        path.length > 32 ||
        path.some(
          (key) =>
            !['string', 'number'].includes(typeof key) ||
            ['__proto__', 'constructor', 'prototype'].includes(String(key)),
        )
      )
        return null;
      if (!path.length) {
        next = value;
        continue;
      }
      let target = next;
      for (const key of path.slice(0, -1)) {
        if (!object(target) || !Object.hasOwn(target, key)) return null;
        target = target[key];
      }
      if (!object(target)) return null;
      target[path.at(-1)!] = value;
    }
    const result = next as GameSnapshot;
    return result?.version === packet.version &&
      Array.isArray(result?.world?.players)
      ? result
      : null;
  }
}
