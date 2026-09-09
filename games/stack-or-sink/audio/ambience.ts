import { clamp } from '../../../shared/math/clamp';
import { type World, type Player } from '../types';
import type { Point, AudioEvent } from '../../../shared/audio/world';

export function stackAcoustics(id: string) {
  if (id.startsWith('coast.gull')) return { range: 65, near: 8 };
  if (id.startsWith('coast.palm')) return { range: 23, near: 3 };
  if (id.startsWith('water.drip')) return { range: 9, near: 1 };
  if (id.startsWith('strain.')) return { range: 15, near: 2 };
  if (id.startsWith('step.')) return { range: 13, near: 1.5 };
  if (id.startsWith('land.')) return { range: 19, near: 2 };
  return { range: 30, near: 3 };
}
export function stackAttenuation(id: string, metres: number) {
  const { range, near } = stackAcoustics(id);
  return clamp((range - metres) / (range - near), 0, 1) ** 1.5;
}

export function stackLoopLevels(
  world: World,
  listener: Point & Partial<Pick<Player, 'breath' | 'down'>>,
) {
  const height = Math.max(0, (listener.y ?? 0) - world.water);
  const edge = Math.max(
    0,
    11 - Math.max(Math.abs(listener.x), Math.abs(listener.z)),
  );
  const flood =
    world.mode === 'normal' && world.phase === 'playing' && world.water > 0;
  const progress = flood ? clamp(world.water / 12, 0, 1) : 0;
  const danger = flood
    ? Math.max(
        clamp((2 - height) / 2, 0, 1),
        listener.down ? 1 : clamp((5 - (listener.breath ?? 8)) / 5, 0, 1),
      )
    : 0;
  const breeze =
    0.04 * Math.sin(world.clock / 11000) + 0.03 * Math.sin(world.clock / 19000);
  return {
    surf: clamp((0.48 + 0.45 * (1 - edge / 11)) / (1 + height / 7), 0.12, 1),
    wind: clamp(0.5 + height / 30 + breeze, 0.35, 0.95),
    flood: flood ? clamp(1 - height / 6, 0, 1) * (0.55 + progress * 0.4) : 0,
    music: clamp(0.75 + progress * 0.15 + danger * 0.1, 0, 1),
    challenge: flood,
  };
}

const palms: Point[] = [
  { x: -11.1, y: 3.5, z: -5.3 },
  { x: 10.9, y: 3.2, z: 4.2 },
  { x: -7.5, y: 2.4, z: 11.2 },
];
const gulls: Point[] = [
  { x: -20, y: 10, z: -15 },
  { x: 22, y: 12, z: 8 },
  { x: -8, y: 9, z: 24 },
];
const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, (a.y ?? 0) - (b.y ?? 0), a.z - b.z);

/** Sparse environment details and physically triggered Foley; never plays on snapshot catch-up. */
export class StackAmbience {
  private due = new Map<string, number>();
  private contacts = new Map<string, number>();
  private lastNature = -Infinity;
  private clock = -Infinity;
  constructor(private random: () => number = Math.random) {}
  reset() {
    this.due.clear();
    this.contacts.clear();
    this.lastNature = -Infinity;
    this.clock = -Infinity;
  }
  update(
    world: World,
    previous: World | undefined,
    listener: Point,
  ): AudioEvent[] {
    if (world.phase !== 'playing') {
      this.reset();
      return [];
    }
    if (world.clock <= this.clock) return [];
    if (
      !previous ||
      previous.started !== world.started ||
      world.clock - previous.clock > 2500
    ) {
      this.reset();
      previous = undefined;
    }
    this.clock = world.clock;
    const events: AudioEvent[] = [];
    for (const [id, min, spread, positions] of [
      ['coast.gull', 14000, 17000, gulls],
      [
        'coast.palm',
        9000,
        15000,
        palms.filter((p) => world.water < (p.y ?? 0)),
      ],
    ] as const) {
      const deadline = this.due.get(id);
      if (deadline !== undefined && world.clock < deadline) continue;
      this.due.set(id, world.clock + min + this.random() * spread);
      if (deadline === undefined || world.clock - this.lastNature < 2400)
        continue;
      const audible = positions.filter(
        (p) => distance(p, listener) < stackAcoustics(id).range,
      );
      if (!audible.length) continue;
      events.push({
        id,
        variant: true,
        strength: 0.65 + this.random() * 0.2,
        position: audible[Math.floor(this.random() * audible.length)],
      });
      this.lastNature = world.clock;
    }
    if (!previous || previous.phase !== 'playing') return events;
    const oldPieces = new Map(previous.pieces.map((p) => [p.id, p]));
    const candidates: AudioEvent[] = [];
    const add = (key: string, event: AudioEvent, cooldown: number) => {
      if (
        distance(event.position!, listener) >= stackAcoustics(event.id).range ||
        world.clock < (this.contacts.get(key) ?? 0)
      )
        return;
      candidates.push(event);
      this.contacts.set(key, world.clock + cooldown);
    };
    for (const p of world.pieces) {
      const old = oldPieces.get(p.id);
      if (!old || distance(p, old) > 2) continue;
      if (
        p.heldBy &&
        old.y <= previous.water &&
        p.y > world.water &&
        p.y > old.y
      )
        add(
          `${p.id}:drip`,
          { id: 'water.drip', variant: true, position: p, strength: 0.75 },
          2500,
        );
      const travel = distance(p, old);
      const turn = Math.hypot(
        p.angular?.x ?? 0,
        p.angular?.y ?? 0,
        p.angular?.z ?? 0,
      );
      if (
        !p.heldBy &&
        !old.heldBy &&
        !p.sleeping &&
        Math.abs(p.vy) < 0.5 &&
        travel > 0.015 &&
        (turn > 0.12 || Math.hypot(p.vx ?? 0, p.vz ?? 0) > 0.15)
      ) {
        const surface =
          p.kind === 'sofa'
            ? 'fabric'
            : ['fridge', 'bathtub'].includes(p.kind)
              ? 'metal'
              : 'wood';
        add(
          `${p.id}:strain`,
          {
            id: `strain.${surface}`,
            variant: true,
            position: p,
            strength: clamp(0.3 + travel * 2, 0.3, 0.75),
          },
          2400,
        );
      }
      if (p.heldBy === 'crane' && old.heldBy === 'crane' && travel > 0.035)
        add(
          'crane',
          { id: 'crane.cable', variant: true, position: p, strength: 0.65 },
          5000,
        );
    }
    candidates.sort(
      (a, b) =>
        distance(a.position!, listener) - distance(b.position!, listener),
    );
    events.push(...candidates.slice(0, 2));
    for (const p of world.players) {
      const old = previous.players.find((v) => v.id === p.id);
      if (old?.down && !p.down) {
        if (world.clock >= (this.contacts.get('rescue-music') ?? 0)) {
          events.push({ id: 'music.cinematic.rescue', strength: 0.8 });
          this.contacts.set('rescue-music', world.clock + 8000);
        }
        break;
      }
    }
    return events;
  }
}
