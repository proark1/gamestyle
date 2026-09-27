import type { FeedbackTier } from './presentation';

export type EffectRequest = {
  id: number;
  tier: FeedbackTier;
  at: number;
  x: number;
  z: number;
};

const PRIORITY: Record<FeedbackTier, number> = {
  minor: 0,
  course: 1,
  major: 2,
  celebration: 3,
};

export class BoundedEffectQueue {
  private seen = new Set<number>();
  private entries: EffectRequest[] = [];

  constructor(private limit: number) {}

  ingest(request: EffectRequest) {
    if (this.seen.has(request.id)) return false;
    this.seen.add(request.id);
    if (this.entries.length < this.limit) {
      this.entries.push(request);
      return true;
    }
    let weakest = 0;
    for (let index = 1; index < this.entries.length; index++)
      if (
        PRIORITY[this.entries[index].tier] <
        PRIORITY[this.entries[weakest].tier]
      )
        weakest = index;
    if (PRIORITY[request.tier] <= PRIORITY[this.entries[weakest].tier])
      return false;
    this.entries[weakest] = request;
    return true;
  }

  active(now: number, lifetime = 900) {
    this.entries = this.entries.filter(
      (request) => now - request.at <= lifetime,
    );
    return [...this.entries];
  }

  reset() {
    this.seen.clear();
    this.entries = [];
  }
}

export class CameraImpulseController {
  x = 0;
  y = 0;
  zoom = 0;
  private vx = 0;
  private vy = 0;
  private vz = 0;

  kick(strength: number, seed = 1) {
    const amount = Math.min(1, Math.max(0, strength));
    this.vx += Math.sin(seed * 91.7) * amount * 0.7;
    this.vy += Math.cos(seed * 53.3) * amount * 0.42;
    this.vz += amount * 0.58;
  }

  update(dt: number) {
    const step = Math.min(0.05, Math.max(0, dt));
    this.vx += -this.x * 28 * step;
    this.vy += -this.y * 28 * step;
    this.vz += -this.zoom * 34 * step;
    const damping = Math.exp(-10 * step);
    this.vx *= damping;
    this.vy *= damping;
    this.vz *= damping;
    this.x = Math.max(-0.34, Math.min(0.34, this.x + this.vx * step));
    this.y = Math.max(-0.22, Math.min(0.22, this.y + this.vy * step));
    this.zoom = Math.max(0, Math.min(0.5, this.zoom + this.vz * step));
    return { x: this.x, y: this.y, zoom: this.zoom };
  }

  reset() {
    this.x = this.y = this.zoom = this.vx = this.vy = this.vz = 0;
  }
}
