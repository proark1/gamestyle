import type { HotelSnapshot } from './types';

export type HotelPoint = { x: number; z: number };

/** The same private snapshot drives visible motion and its Foley, including after handover. */
export function hotelHorror(snapshot: HotelSnapshot) {
  const { world: w, you } = snapshot;
  const inspect = w.phase === 'playing' && w.stage === 'inspect';
  const elapsed = Math.max(0, w.clock - w.stopAt);
  const seed = (Math.floor(w.stopAt) + w.run * 137 + w.cleared * 71) >>> 0;
  const period = 13000 + (seed % 5000);
  const cycle = Math.floor(elapsed / period);
  const time = elapsed % period;
  const onset = 5200 + ((seed + cycle * 977) % 2200);
  const encounterTime = time - onset;
  const disturbed = inspect && (you.anomaly || you.apparition);
  const encounter = disturbed && encounterTime >= 0 && encounterTime < 4100;
  const fade = encounter
    ? Math.min(1, encounterTime / 350, (4100 - encounterTime) / 700)
    : 0;
  // Two separated power dips, never rapid full-screen strobing.
  const lightDip = encounter
    ? fade * (encounterTime < 1200 || encounterTime > 2400 ? 0.86 : 0.35)
    : 0;
  const doorTime = elapsed % 6700;
  const door = inspect && you.anomaly && you.station === 2;
  const knock =
    door && doorTime >= 900 && doorTime < 1800
      ? Math.floor((doorTime - 900) / 300)
      : -1;
  const handle =
    door && doorTime >= 2100 && doorTime < 3100
      ? Math.sin(((doorTime - 2100) / 1000) * Math.PI) * 0.65
      : 0;
  const wetStep = Math.floor((elapsed % 7600) / 560);
  const ghost =
    you.apparition &&
    (w.phase === 'escape' || (encounter && encounterTime > 500));
  return {
    elapsed,
    cycle,
    encounter,
    encounterTime,
    lightDip,
    lamp: (seed + cycle) % 3,
    ghost,
    ghostPosition: {
      x: w.phase === 'escape' ? 0 : (cycle % 2 ? -1 : 1) * 2.8,
      z:
        w.phase === 'escape'
          ? w.ghostZ
          : cycle === 0
            ? -21
            : [-18, -8, -22][(seed + cycle) % 3],
    },
    knock,
    knockKey: knock < 0 ? '' : `${Math.floor(elapsed / 6700)}:${knock}`,
    handle,
    handleKey: handle > 0 ? `${Math.floor(elapsed / 6700)}` : '',
    doorShake:
      knock >= 0
        ? Math.sin((((doorTime - 900) % 300) / 300) * Math.PI * 2) * 0.018
        : 0,
    wetStep:
      inspect && you.anomaly && you.station === 0 && wetStep < 10
        ? wetStep
        : -1,
    wetKey:
      inspect && you.anomaly && you.station === 0 && wetStep < 10
        ? `${Math.floor(elapsed / 7600)}:${wetStep}`
        : '',
    clockStep:
      inspect && you.anomaly && you.station === 3
        ? Math.floor(elapsed / 720)
        : 0,
    portrait: inspect && you.anomaly && you.station === 1 && encounter,
    active: inspect || w.phase === 'escape',
  };
}

export function hotelSurface({ x, z }: HotelPoint) {
  return z > 1 ? 'metal' : Math.abs(x) <= 2.65 ? 'carpet' : 'wood';
}

export function hotelAcoustics(
  source: HotelPoint,
  listener: HotelPoint,
  yaw: number,
) {
  const dx = source.x - listener.x,
    dz = source.z - listener.z;
  const distance = Math.hypot(dx, dz);
  return {
    gain: distance >= 23 ? 0 : 1 / (1 + distance * distance * 0.065),
    pan: Math.max(
      -0.9,
      Math.min(
        0.9,
        (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / Math.max(3, distance),
      ),
    ),
  };
}

/** Distance-based strides for every guest; no sound from walls, teleports or resumed tabs. */
export class HotelFootsteps {
  private previous = new Map<
    string,
    HotelPoint & { time: number; stride: number }
  >();
  update(snapshot: HotelSnapshot) {
    const { world: w } = snapshot;
    const steps: {
      id: string;
      position: HotelPoint;
      surface: ReturnType<typeof hotelSurface>;
      running: boolean;
    }[] = [];
    const active =
      w.phase === 'escape' || (w.phase === 'playing' && w.stage === 'inspect');
    const present = new Set(w.players.map((p) => p.id));
    for (const id of this.previous.keys())
      if (!present.has(id)) this.previous.delete(id);
    for (const p of w.players) {
      const old = this.previous.get(p.id);
      const next = { x: p.x, z: p.z, time: w.clock, stride: old?.stride ?? 0 };
      this.previous.set(p.id, next);
      if (!old) continue;
      const dt = w.clock - old.time;
      const distance = Math.hypot(p.x - old.x, p.z - old.z);
      if (
        !active ||
        p.caught ||
        p.safe ||
        dt > 650 ||
        dt < 0 ||
        distance > (6.2 * dt) / 1000 + 0.15
      ) {
        next.stride = 0;
        continue;
      }
      if (dt === 0 || distance < 0.002) continue;
      const running = distance / dt > 0.0046;
      next.stride += distance;
      const stride = running ? 1.65 : 1.45;
      if (next.stride >= stride) {
        next.stride %= stride;
        steps.push({
          id: p.id,
          position: { x: p.x, z: p.z },
          surface: hotelSurface(p),
          running,
        });
      }
    }
    return steps;
  }
  reset() {
    this.previous.clear();
  }
}
