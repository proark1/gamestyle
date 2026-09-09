export type Point = { x: number; y?: number; z: number };
export type AudioEvent = {
  id: string;
  position?: Point;
  strength?: number;
  variant?: boolean;
  sourceId?: string;
};
/** Distance travelled, never held buttons; corrections and stationary frames are silent. */
export class Footsteps {
  private bodies = new Map<
    string,
    {
      position: Point;
      grounded: boolean;
      stride: number;
      time: number;
      peak: number;
    }
  >();
  reset() {
    this.bodies.clear();
  }
  update(
    id: string,
    position: Point,
    grounded: boolean,
    surface: string,
    now: number,
    materialLandings = false,
  ): AudioEvent[] {
    const old = this.bodies.get(id),
      next = {
        position: { ...position },
        grounded,
        stride: old?.stride ?? 0,
        time: now,
        peak:
          !old || old.grounded
            ? (position.y ?? 0)
            : Math.max(old.peak, position.y ?? 0),
      };
    this.bodies.set(id, next);
    if (!old || now - old.time > 1000) return [];
    const distance = Math.hypot(
      position.x - old.position.x,
      position.z - old.position.z,
    );
    if (distance > 1.5 || now < old.time) {
      next.stride = 0;
      return [];
    }
    const cues: AudioEvent[] = [];
    if (grounded) {
      next.stride += distance;
      if (next.stride >= (surface === 'hoof' ? 0.72 : 0.85)) {
        cues.push({ id: `step.${surface}`, position });
        next.stride = 0;
      }
    }
    if (surface !== 'hoof' && surface !== 'grass') {
      if (
        old.grounded &&
        !grounded &&
        (position.y ?? 0) > (old.position.y ?? 0) + 0.04
      )
        cues.push({ id: 'event.jump', position });
      if (!old.grounded && grounded)
        cues.push(
          materialLandings
            ? {
                id: `land.${surface}`,
                position,
                variant: true,
                strength: Math.max(
                  0.3,
                  Math.min(1, (old.peak - (position.y ?? 0)) / 3 + 0.3),
                ),
              }
            : { id: 'event.land', position },
        );
    }
    return cues;
  }
}
