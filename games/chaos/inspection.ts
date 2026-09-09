import { findPath } from './colliders';
import { footprint } from './placement';
import type { Player, Vec, World } from './model';

export type RoundFormat = 'classic' | 'inspection' | 'swap';
export type Moment = {
  id: string;
  at: number;
  text: string;
  x: number;
  z: number;
};
export type FunctionalCheck = {
  access: boolean;
  covered: number;
  samples: number;
  delivered: boolean;
  route: Vec[];
  passed: boolean;
};
export type Inspection = {
  version: 1;
  target: Vec;
  rainAt: number;
  rainUntil: number;
  leakFixed: boolean;
  steadyUntil: number;
  nextSteadyAt: number;
  check?: FunctionalCheck;
  firstCheck?: FunctionalCheck;
  checkedAt?: number;
  repairers: string[];
  moments: Moment[];
};

export const INSPECTION_ENTRY = { x: 0, z: 5 };
export function makeInspection(target: Vec = { x: 0, z: 0 }): Inspection {
  return {
    version: 1,
    target: { ...target },
    rainAt: 0,
    rainUntil: 0,
    leakFixed: false,
    steadyUntil: 0,
    nextSteadyAt: 0,
    repairers: [],
    moments: [],
  };
}
export function configureInspection(world: World) {
  const p = world.party!;
  if (p.format !== 'inspection') {
    delete p.inspection;
    return;
  }
  p.inspection = makeInspection(p.inspection?.target);
  p.job = 'sofa';
  Object.assign(p.task, { kind: 'sofa', target: { ...p.inspection.target } });
}
export function roofSamples(target: Vec): Vec[] {
  return [-0.8, 0, 0.8].flatMap((x) =>
    [-0.6, 0, 0.6].map((z) => ({ x: target.x + x, z: target.z + z })),
  );
}
export function inspectConstruction(world: World): FunctionalCheck {
  const p = world.party!,
    target = p.inspection!.target;
  // The crew physically carries the full sofa; the customer is checked with the
  // same obstacle-aware walking path as a player, including door jambs.
  const route = findPath(world, INSPECTION_ENTRY, target, 0.55) || [];
  const roofs = world.pieces
    .filter((v) => v.kind === 'roof' && v.placed && !v.heldBy && !v.hoisted)
    .map((v) => footprint(v.kind, v, v.rotation));
  const samples = roofSamples(target);
  const covered = samples.filter((v) =>
    roofs.some(
      (r) => v.x >= r.minX && v.x <= r.maxX && v.z >= r.minZ && v.z <= r.maxZ,
    ),
  ).length;
  const delivered =
    p.task.phase === 'done' &&
    Math.hypot(p.task.x - target.x, p.task.z - target.z) <= 1.25;
  return {
    access: route.length > 0,
    covered,
    samples: samples.length,
    delivered,
    route,
    passed: route.length > 0 && covered === samples.length && delivered,
  };
}
export function checkComments(c: FunctionalCheck) {
  return [
    c.access
      ? 'The customer can walk into the living room.'
      : 'The customer is stuck outside. Clear a route into the marked living room.',
    c.covered === c.samples
      ? 'The seating area stays dry. Excellent roofing.'
      : `Rain reaches the seating area. Cover the blue square with roof modules (${c.covered}/${c.samples} dry spots).`,
    c.delivered
      ? 'The sofa is in the living room. Time to put your feet up.'
      : 'The sofa is still outside its bay. Take the handles and bring it inside.',
  ];
}
export function markMoment(world: World, text: string, now: number, pos?: Vec) {
  const i = world.party?.inspection;
  if (!i) return;
  const location = pos || i.target;
  i.moments.push({
    id: crypto.randomUUID(),
    at: now,
    text,
    x: location.x,
    z: location.z,
  });
  i.moments = i.moments.slice(-12);
}
export function inspectRound(
  world: World,
  now: number,
  buildingComplete = true,
): boolean {
  const p = world.party!,
    i = p.inspection!;
  const check = inspectConstruction(world);
  check.passed = check.passed && buildingComplete;
  i.check = check;
  i.checkedAt = now;
  p.task.roles = ['', ''];
  p.task.inputs = {};
  if (p.task.phase !== 'done' && p.task.phase !== 'spilled')
    p.task.phase = 'waiting';
  if (!check.passed && !i.firstCheck) {
    i.firstCheck = check;
    p.phase = 'rescue';
    p.phaseAt = now;
    p.deadline = now + 20000;
    markMoment(
      world,
      checkComments(check).find((_, index) =>
        index === 0
          ? !check.access
          : index === 1
            ? check.covered < check.samples
            : !check.delivered,
      ) || 'Twenty seconds to save the inspection.',
      now,
    );
    return false;
  }
  markMoment(
    world,
    check.passed
      ? i.firstCheck
        ? 'They saved the inspection with seconds to spare.'
        : 'The customer tested it. It actually worked.'
      : 'The customer found a few creative decisions.',
    now,
  );
  return true;
}
export function inspectionAction(
  world: World,
  op: 'repair' | 'steady',
  player: Player,
  now: number,
) {
  const p = world.party!,
    i = p.inspection;
  if (!i || !['building', 'lastCall', 'rescue'].includes(p.phase))
    throw new Error('This inspection shift is not running.');
  if (
    world.pieces.some((v) => v.heldBy === player.id) ||
    world.crane?.operatorId === player.id
  )
    throw new Error('Put down your tools first.');
  if (op === 'repair') {
    if (now < i.rainAt || now > i.rainUntil || i.leakFixed)
      throw new Error('There is no active leak to repair.');
    if (Math.hypot(player.x - i.target.x, player.z - (i.target.z + 2)) > 2.8)
      throw new Error('Walk to the blue leaking pipe first.');
    i.leakFixed = true;
    markMoment(
      world,
      'A builder stopped the leak before the next delivery.',
      now,
      player,
    );
  } else {
    if (now < i.nextSteadyAt)
      throw new Error('Give the delivery a moment before steadying it again.');
    if (p.task.phase !== 'working' || p.task.tilt < 0.25)
      throw new Error('The delivery is steady enough.');
    if (Math.hypot(player.x - p.task.x, player.z - p.task.z) > 3)
      throw new Error('Move closer to steady the delivery.');
    if (p.task.roles.includes(player.id) && !p.task.solo)
      throw new Error('Ask a builder with free hands to steady the load.');
    p.task.tilt = Math.max(0, p.task.tilt - 0.65);
    i.steadyUntil = now + 3000;
    i.nextSteadyAt = now + 7000;
    p.stats.rescues++;
    markMoment(world, 'A builder caught the wobbling sofa.', now, p.task);
  }
  i.repairers = [...new Set([...i.repairers, player.id])];
}
