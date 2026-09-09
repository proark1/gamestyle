import type { ItemKind, Piece, World } from './model';
import type { MapId } from './maps';
import type { CrewJob } from './party';
import { makeInspection } from './inspection';
import { setDaily } from './daily';
import { JOBS } from './model';
import type { RoundFormat } from './inspection';
import type { ChallengeBenchmark } from './disaster-challenge';
export type BuildSnapshot = {
  version: 1;
  challenge?: ChallengeBenchmark;
  startRules?: {
    origin: { x: number; z: number };
    target: { x: number; z: number };
    angle: number;
    missions: number[];
    rainAfter?: number;
    rainDuration?: number;
  };
  map: MapId;
  pieces: Piece[];
  format: RoundFormat;
  job: CrewJob;
  seed: number;
  brief: number;
  daily?: string;
  target?: { x: number; z: number };
  delivery?: { x: number; z: number; angle: number; done: boolean };
};
export type SavedBuild = {
  id: string;
  title: string;
  author: string;
  sourceId: string | null;
  created: number;
  build: BuildSnapshot;
};
export function buildSnapshot(world: World): BuildSnapshot {
  const pieces = world.pieces
    .filter((p) => !p.supply && !p.hoisted && !p.heldBy)
    .slice(0, 160)
    .map(
      (p, index): Piece => ({
        id: `saved-${index}`,
        kind: p.kind as ItemKind,
        x: p.x,
        z: p.z,
        rotation: p.rotation,
        placed: p.placed,
        ...(p.level ? { level: p.level } : {}),
        ...(p.color !== undefined ? { color: p.color } : {}),
        ...(p.paint !== undefined ? { paint: p.paint } : {}),
        ...(p.finish !== undefined ? { finish: p.finish } : {}),
        ...(p.usedAt !== undefined || p.tried ? { tried: true } : {}),
        ...(!p.placed && p.physics
          ? {
              physics: {
                y: p.physics.y,
                q: [...p.physics.q] as [number, number, number, number],
                v: [0, 0, 0],
                w: [0, 0, 0],
                sleep: true,
              },
            }
          : {}),
      }),
    );
  const p = world.party;
  return {
    version: 1,
    map: world.map || 'small',
    pieces,
    format: p?.format === 'swap' ? 'classic' : p?.format || 'classic',
    job: p?.job || 'sofa',
    seed: p?.seed || 0,
    brief: world.round % JOBS.length,
    ...(p?.daily ? { daily: p.daily.date } : {}),
    ...(p?.inspection ? { target: { ...p.inspection.target } } : {}),
    ...(p
      ? {
          delivery: {
            x: p.task.x,
            z: p.task.z,
            angle: p.task.angle,
            done: p.task.phase === 'done',
          },
        }
      : {}),
  };
}
export function restoreBuild(
  world: World,
  saved: BuildSnapshot,
  id: string,
  mode: 'try' | 'explore' | 'remix',
) {
  if (saved.version !== 1)
    throw new Error('This build version is unsupported.');
  world.pieces = [
    ...structuredClone(saved.pieces),
    ...world.pieces.filter(
      (p) => p.supply && !saved.pieces.some((v) => v.id === p.id),
    ),
  ];
  world.round = saved.brief;
  world.sharedFrom = id;
  if (world.party) {
    world.party.format = saved.format;
    world.party.seed = saved.seed;
    if (saved.target) {
      world.party.inspection = makeInspection(saved.target);
      world.party.task.target = { ...saved.target };
    }
    delete world.party.daily;
    if (saved.daily) setDaily(world, saved.daily, world.started);
    if (mode === 'try' && saved.challenge) {
      world.party.challenge = { ...saved.challenge, buildId: id };
      world.challengeSetup = structuredClone(saved);
    }
    if (mode !== 'try' && saved.delivery) {
      Object.assign(world.party.task, saved.delivery, {
        phase: saved.delivery.done ? 'done' : 'waiting',
      });
    }
  }
}
