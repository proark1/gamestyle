export const COMPACT_QUERY =
  '(max-width: 1024px), (max-height: 500px), (pointer: coarse)';
export const TOUCH_QUERY = '(pointer: coarse)';

export function touchSprint(amount: number, active: boolean) {
  return (
    Number.isFinite(amount) &&
    amount > 0 &&
    (active ? amount >= 0.8 : amount >= 0.9)
  );
}

export function cameraMovement(x: number, z: number, yaw: number) {
  return {
    x: x * Math.cos(yaw) + z * Math.sin(yaw),
    z: -x * Math.sin(yaw) + z * Math.cos(yaw),
  };
}

export type HeldInput = { x: number; z: number; turn: number; work: boolean };
export class HeldInputs {
  sources = new Map<string, Partial<HeldInput>>();
  set(source: string, input: Partial<HeldInput>): HeldInput {
    if (Object.values(input).some(Boolean)) this.sources.set(source, input);
    else this.sources.delete(source);
    const value = { x: 0, z: 0, turn: 0, work: false };
    for (const held of this.sources.values()) {
      value.x += held.x || 0;
      value.z += held.z || 0;
      value.turn += held.turn || 0;
      value.work ||= !!held.work;
    }
    for (const axis of ['x', 'z', 'turn'] as const)
      value[axis] = Math.max(-1, Math.min(1, value[axis]));
    return value;
  }
  clear(): HeldInput {
    this.sources.clear();
    return { x: 0, z: 0, turn: 0, work: false };
  }
}
type Point = { x: number; y: number };
type Contact = Point & {
  startX: number;
  startY: number;
  at: number;
  moved: boolean;
};
export type Gesture = {
  orbit: number;
  zoom: number;
  panX: number;
  panY: number;
};

/** Tracks canvas contacts only; joystick and UI fingers never enter this tracker. */
export class TouchGesture {
  contacts = new Map<number, Contact>();
  multi = false;
  down(id: number, x: number, y: number, at: number) {
    this.contacts.set(id, { x, y, startX: x, startY: y, at, moved: false });
    if (this.contacts.size > 1) this.multi = true;
  }
  move(id: number, x: number, y: number): Gesture | null {
    const point = this.contacts.get(id);
    if (!point) return null;
    const before = [...this.contacts.values()].map((p) => ({ x: p.x, y: p.y }));
    const dx = x - point.x;
    point.x = x;
    point.y = y;
    point.moved ||= Math.hypot(x - point.startX, y - point.startY) > 8;
    if (this.multi && this.contacts.size === 1) return null;
    if (this.contacts.size === 1)
      return point.moved
        ? { orbit: dx * 0.006, zoom: 1, panX: 0, panY: 0 }
        : null;
    const after = [...this.contacts.values()];
    const length = (p: Point[]) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
    return {
      orbit: 0,
      zoom: Math.max(1, length(after)) / Math.max(1, length(before)),
      panX: (after[0].x + after[1].x - before[0].x - before[1].x) / 2,
      panY: (after[0].y + after[1].y - before[0].y - before[1].y) / 2,
    };
  }
  up(id: number, x: number, y: number, at: number, cancelled = false) {
    const point = this.contacts.get(id);
    const tap =
      !!point &&
      !cancelled &&
      !this.multi &&
      !point.moved &&
      at - point.at < 600 &&
      Math.hypot(x - point.startX, y - point.startY) <= 8;
    this.contacts.delete(id);
    if (!this.contacts.size) this.multi = false;
    return tap;
  }
  clear() {
    this.contacts.clear();
    this.multi = false;
  }
}

export function joystickVector(x: number, z: number) {
  const length = Math.hypot(x, z);
  if (!Number.isFinite(length) || length < 0.12) return { x: 0, z: 0 };
  const amount = Math.min(1, (length - 0.12) / 0.88);
  return { x: (x / length) * amount, z: (z / length) * amount };
}
