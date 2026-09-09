import { PANEL, distance, type FarmView, type Point } from './types';
import { fenceDistance } from './fence';
import type { AudioEvent } from '../../shared/audio/world';

/** Intimate Foley belongs beside its source; calls carry across the pasture. */
export function farmAcoustics(id: string) {
  if (/^item\.(key|ladder)\.(grab|drop|unlock|place)$/.test(id))
    return { range: 5, near: 1 };
  if (id === 'event.fence-shock') return { range: 30, near: 3 };
  if (id.startsWith('animal.graze.')) return { range: 4, near: 0.7 };
  if (id.startsWith('animal.breath.')) return { range: 3.5, near: 0.6 };
  if (id.startsWith('animal.snuffle.')) return { range: 4.5, near: 0.8 };
  if (id.startsWith('animal.scuff.')) return { range: 6, near: 1 };
  if (id.startsWith('animal.moo.')) return { range: 34, near: 3 };
  if (id.startsWith('nature.bird.')) return { range: 40, near: 3 };
  if (id.startsWith('nature.insect.')) return { range: 5, near: 0.5 };
  if (id.startsWith('nature.leaves.')) return { range: 18, near: 2 };
  if (id.startsWith('nature.barn.')) return { range: 20, near: 2 };
  if (id.startsWith('nature.trough.')) return { range: 7, near: 0.8 };
  if (id.startsWith('nature.wings.')) return { range: 14, near: 1.5 };
  if (id.startsWith('movement.grass.')) return { range: 5, near: 0.6 };
  if (id.startsWith('item.ladder.carry.')) return { range: 8, near: 1 };
  if (id.startsWith('step.')) return { range: 11, near: 1 };
  return { range: 24, near: 2 };
}

export function farmAttenuation(id: string, metres: number) {
  const { range, near } = farmAcoustics(id);
  const gain = Math.max(0, Math.min(1, (range - metres) / (range - near)));
  return gain * gain;
}

const trees: Point[] = [
  { x: -14, z: -8 },
  { x: 13, z: -9 },
  { x: -14, z: 5 },
  { x: 14, z: 11 },
  { x: 0, z: -16 },
  { x: -8, z: 15 },
];
const barn = { x: -7, z: -11 };
const trough = { x: -3, z: -6.9 };
/** Shared weather envelope: details occur during the same breeze as the bed. */
export function farmBreeze(clock: number) {
  return (
    0.5 + Math.sin(clock / 11_000) * 0.26 + Math.sin(clock / 19_000) * 0.16
  );
}
const details = [
  ['animal.moo', 8_000, 19_000],
  ['animal.graze', 2_500, 6_000],
  ['animal.breath', 6_000, 13_000],
  ['animal.snuffle', 12_000, 25_000],
  ['nature.bird', 16_000, 32_000],
  ['nature.insect', 24_000, 45_000],
  ['nature.leaves', 12_000, 26_000],
  ['nature.barn', 28_000, 48_000],
  ['nature.trough', 10_000, 22_000],
  ['nature.wings', 20_000, 40_000],
  ['movement.grass', 2_200, 4_600],
  ['item.ladder.carry', 4_200, 8_500],
] as const;

/** Public cow state only: ownership and private AI routines never enter the director. */
export class FarmAmbience {
  private due = new Map<string, number>();
  private lastDetail = -Infinity;
  private lastWildlife = -Infinity;
  private previous?: {
    clock: number;
    round: number;
    started: number;
    positions: Map<string, Point>;
  };
  constructor(private random: () => number = Math.random) {}
  reset() {
    this.due.clear();
    this.lastDetail = -Infinity;
    this.lastWildlife = -Infinity;
    this.previous = undefined;
  }
  update(world: FarmView, listener: Point): AudioEvent[] {
    if (world.phase !== 'playing') {
      this.reset();
      return [];
    }
    const living = world.cows.filter((cow) => !cow.captured && !cow.escaped);
    const bodies = [
      ...living,
      { ...world.farmer, id: 'farmer', moving: true, carrying: null },
    ];
    const previous = this.previous;
    if (
      previous &&
      world.round === previous.round &&
      world.started === previous.started &&
      world.clock <= previous.clock
    )
      return [];
    const continuous =
      previous &&
      world.round === previous.round &&
      world.started === previous.started &&
      world.clock - previous.clock <= 1_000;
    if (!continuous) this.reset();
    this.previous = {
      clock: world.clock,
      round: world.round,
      started: world.started,
      positions: new Map(
        bodies.map((body) => [body.id, { x: body.x, z: body.z }]),
      ),
    };
    const moving = continuous
      ? bodies.filter((body) => {
          const before = previous.positions.get(body.id);
          const travelled = before ? distance(before, body) : 0;
          return body.moving && travelled > 0.025 && travelled <= 1.5;
        })
      : [];
    const breeze = farmBreeze(world.clock);
    const events: AudioEvent[] = [];
    for (const [id, min, max] of details) {
      const deadline = this.due.get(id);
      if (deadline === undefined || world.clock >= deadline) {
        this.due.set(id, world.clock + min + this.random() * (max - min));
        if (deadline === undefined || world.clock - this.lastDetail < 1_200)
          continue;
        const windDriven =
          id === 'nature.leaves' ||
          id === 'nature.barn' ||
          id === 'nature.trough';
        const wildlife =
          id === 'nature.bird' ||
          id === 'nature.insect' ||
          id === 'nature.wings';
        if (
          (windDriven && breeze < 0.55) ||
          (wildlife && world.clock - this.lastWildlife < 8_000)
        )
          continue;
        const positions: (Point & { id?: string })[] =
          id === 'nature.barn'
            ? [barn]
            : id === 'nature.trough'
              ? [trough]
              : id === 'movement.grass'
                ? moving
                : id === 'item.ladder.carry'
                  ? moving.filter((body) => body.carrying === 'ladder')
                  : id === 'nature.bird' ||
                      id === 'nature.leaves' ||
                      id === 'nature.wings'
                    ? trees
                    : id === 'nature.insect'
                      ? [
                          { x: -8, z: -7 },
                          { x: 7, z: 8 },
                          { x: 8, z: -7 },
                          { x: -8, z: 7 },
                        ]
                      : living.filter((cow) =>
                          id === 'animal.graze'
                            ? cow.grazing && !cow.moving
                            : id === 'animal.moo' || !cow.moving,
                        );
        const audible = positions.filter(
          (point) => distance(point, listener) < farmAcoustics(`${id}.1`).range,
        );
        if (!audible.length) continue;
        const position = audible[Math.floor(this.random() * audible.length)];
        events.push({
          id,
          position,
          ...(position.id ? { sourceId: position.id } : {}),
          strength:
            (id === 'animal.moo' ? 0.65 : 0.45) *
            (0.85 + this.random() * 0.15) *
            (windDriven ? breeze : 1),
          variant: true,
        });
        this.lastDetail = world.clock;
        if (wildlife) this.lastWildlife = world.clock;
      }
    }
    return events;
  }
}

export function farmLoopLevels(listener: Point, clock: number) {
  // Slow, overlapping changes avoid a conspicuous repeating swell.
  const breeze = 0.55 + farmBreeze(clock) * 0.3;
  const edge = fenceDistance(listener);
  return {
    breeze,
    fence: 0.9 * Math.max(0, 1 - edge / 4) ** 1.3,
    panel: Math.max(0, 1 - distance(listener, PANEL) / 7) ** 2,
  };
}
