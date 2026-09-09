import { type Hazard, type HazardKind } from './types';

const kinds: HazardKind[] = ['conveyor', 'glove', 'soap', 'spinner'];
export function nextHazard(index: number, now: number): Hazard {
  const lap = Math.floor(index / 4),
    kind = kinds[index % 4];
  const positions = {
    conveyor: [
      [-5, 0],
      [5, 0],
      [0, -5],
      [0, 5],
    ],
    glove: [
      [-12, 0],
      [12, -4],
      [-12, 4],
      [12, 0],
    ],
    soap: [
      [3.6, -3.8],
      [-4, 3.6],
      [-4, -5.5],
      [4, 5.5],
    ],
    spinner: [
      [-6, -4.5],
      [6, 4.5],
      [6, -4.5],
      [-6, 4.5],
    ],
  };
  const [x, z] = positions[kind][lap];
  return {
    id: index,
    kind,
    x,
    z,
    direction: lap % 2 ? -1 : 1,
    starts: now + 1400,
    cycle: -1,
  };
}
/** The renderer and collision rules share the exact same timed glove path. */
export function glovePose(h: Hazard, clock: number) {
  const age = clock - h.starts;
  const period = 5400;
  const phase = ((age % period) + period) % period;
  const active = age >= 0 && phase >= 1100 && phase < 1650;
  const reach =
    age < 0 || phase < 1100
      ? 0
      : phase < 1650
        ? (phase - 1100) / 550
        : phase < 2250
          ? 1 - (phase - 1650) / 600
          : 0;
  return {
    x: h.x + h.direction * reach * 23,
    z: h.z,
    active,
    warning: age >= -1000 && phase < 1100,
    cycle: Math.floor(age / period),
  };
}
export function spinnerAngle(h: Hazard, clock: number) {
  return (
    (Math.max(0, clock - h.starts) / 1000) *
    (1.2 + Math.floor(h.id / 4) * 0.2) *
    h.direction
  );
}
