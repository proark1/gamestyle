import type { Angler, CatchKind, ReelWorld, Vector } from './types';

export const FIRST_DELIVERY = {
  id: 'first-delivery',
  duration: 480_000,
  target: 3,
} as const;
export const HARBOR = {
  home: { x: 0, z: 33.4 },
  fish: { x: -9, z: 16 },
  repair: { x: 12, z: 23 },
  dock: { x: 12, z: 28 },
  frame: { x: 14, z: 28 },
} as const;
export type Course = 'fish' | 'home' | 'repair';
export type Cargo = {
  id: string;
  kind: CatchKind;
  location: 'boat' | 'water' | 'delivered' | 'lost';
  x: number;
  z: number;
  until: number;
};
export type ComponentKind = 'deck-a' | 'deck-b' | 'barrels' | 'paddle';
export type Component = Vector & {
  id: ComponentKind;
  carrier: string | null;
  installed: boolean;
  droppedAt: number;
};
export type Mission = {
  id: 'first-delivery';
  status: 'sailing' | 'recovering' | 'completed' | 'failed';
  cargo: Cargo[];
  nextCargo: number;
  delivered: number;
  caught: number;
  lost: number;
  lessonAt: number;
  lessonDone: boolean;
  raft: boolean;
  course: Course | null;
  components: Component[];
  holds: Record<string, { target: string; progress: number }>;
  latched: string[];
  recoveryStarted: number;
  rebuilds: number;
};
export const componentHome = (index: number) => ({
  x: 8.8,
  z: 25.6 + index * 1.4,
});
export const freshMission = (): Mission => ({
  id: FIRST_DELIVERY.id,
  status: 'sailing',
  cargo: [],
  nextCargo: 0,
  delivered: 0,
  caught: 0,
  lost: 0,
  lessonAt: 0,
  lessonDone: false,
  raft: false,
  course: null,
  components: [],
  holds: {},
  latched: [],
  recoveryStarted: 0,
  rebuilds: 0,
});
export const roundDuration = (w?: ReelWorld | null) =>
  w?.mission ? FIRST_DELIVERY.duration : 300_000;
export const distance = (a: Vector, b: Vector) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export const carriedCargo = (w: ReelWorld) =>
  w.mission?.cargo.filter((c) => c.location === 'boat').length ?? 0;
export const cargoCapacity = (w: ReelWorld) => (w.mission?.raft ? 3 : 6);
export function missionPosition(
  w: ReelWorld,
  p: Pick<Angler, 'x' | 'z' | 'swimming' | 'support'>,
): Vector {
  if (p.swimming || p.support === 'dock') return { x: p.x, z: p.z };
  const c = Math.cos(w.boat.yaw),
    s = Math.sin(w.boat.yaw);
  return { x: w.boat.x + p.x * c + p.z * s, z: w.boat.z - p.x * s + p.z * c };
}
export function prepareMission(w: ReelWorld) {
  w.mode = 'campaign';
  w.schemaVersion = 2;
  w.mission = freshMission();
  w.goal = FIRST_DELIVERY.target;
  w.score = 0;
  Object.assign(w.boat, HARBOR.home, { yaw: 0 });
  w.wildlife = [];
  w.debris = [];
  w.nextFlyingFishAt = Number.MAX_SAFE_INTEGER;
  w.leakDueAt = Number.MAX_SAFE_INTEGER;
  w.weather.until = Number.MAX_SAFE_INTEGER;
  w.fish = w.fish.slice(0, 8).map((f, i) => ({
    ...f,
    kind: i % 3 ? 'perch' : 'salmon',
    x: HARBOR.fish.x + Math.sin(i) * 5,
    z: HARBOR.fish.z + Math.cos(i) * 5,
    stamina: i % 3 ? 4 : 6,
  }));
}
