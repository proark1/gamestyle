export type AudioHit = {
  cue: string;
  strength: number;
  source?: string;
  position?: { x: number; z: number };
};
type Walker = {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
};

/** Snapshot-derived footsteps use elapsed simulation time, not render frequency. */
export class MotionCues {
  private previous = new Map<
    string,
    { grounded: boolean; next: number; take: number }
  >();
  reset() {
    this.previous.clear();
  }
  update(
    players: Walker[],
    clock: number,
    grounded: (p: Walker) => boolean,
    prefix = 'event',
  ): AudioHit[] {
    const hits: AudioHit[] = [];
    for (const p of players) {
      const old = this.previous.get(p.id),
        onGround = grounded(p);
      const next = old ?? { grounded: onGround, next: clock + 300, take: 0 };
      const hit = (cue: string, strength: number) =>
        hits.push({ cue, strength, source: p.id, position: p });
      if (old && onGround && !old.grounded) hit(`${prefix}.land`, 0.6);
      if (old && !onGround && old.grounded && p.y > 0.1)
        hit(`${prefix}.jump`, 0.4);
      const speed = Math.hypot(p.vx, p.vz);
      if (old && onGround && speed > 0.7 && clock >= next.next) {
        next.take = (next.take % 3) + 1;
        hit(`${prefix}.step.${next.take}`, Math.min(0.65, 0.25 + speed * 0.05));
        next.next = clock + (speed > 4 ? 270 : 390);
      }
      next.grounded = onGround;
      this.previous.set(p.id, next);
    }
    for (const id of this.previous.keys())
      if (!players.some((p) => p.id === id)) this.previous.delete(id);
    return hits;
  }
}
