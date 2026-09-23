/**
 * The demolition site, laid out along +X from the site gate to the site office.
 * Everything between the two is structure over an open pit, so a worker who
 * misses a step is hanging from the safety line rather than standing on
 * anything. Several stretches have a second, slower way through; that choice is
 * the game.
 */

export type SurfaceKind =
  | 'yard'
  | 'girder'
  | 'catwalk'
  | 'crate'
  | 'scaffold'
  | 'ledge'
  | 'pipe'
  | 'pipe-roof'
  | 'pad'
  | 'office';

export type Box = {
  id: string;
  kind: SurfaceKind;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

const box = (
  id: string,
  kind: SurfaceKind,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  minZ: number,
  maxZ: number,
): Box => ({ id, kind, minX, maxX, minY, maxY, minZ, maxZ });

/** Pivot of the tipping plank between the scaffold and the pendulum ledge. */
export const PLANK = {
  pivotX: 73.0,
  y: 8.0,
  halfLength: 3.0,
  minZ: -1.5,
  maxZ: 1.5,
  /** Radians of tilt past which a worker loses their footing. */
  slipTilt: 0.34,
  maxTilt: 0.55,
};

/** The swinging wrecking load over the high ledge. */
export const PENDULUM = {
  pivotX: 84.0,
  pivotY: 18.0,
  ropeLength: 8.4,
  ballRadius: 1.15,
  /** Starting swing amplitude in radians. */
  amplitude: 0.62,
  /** A worker hanging off the hook bleeds the swing away this fast. */
  riderDamping: 1.9,
  hookReach: 2.2,
};

/**
 * The cargo net hanging off the end of the high structure. The whole course
 * runs forward, so pushing forward on the net climbs down it.
 */
export const NET = {
  x: 118.2,
  minY: 0.0,
  maxY: 8.0,
  minZ: -4.0,
  maxZ: 4.0,
  reach: 0.85,
  climbSpeed: 3.0,
};

export const FINISH_X = 174.0;
export const COURSE_END_X = 180.0;

export type MapId = 'demolition' | 'switchyard';

export const SWITCHYARD = {
  startX: 260,
  finishX: 371,
  endX: 380,
  gates: [
    {
      x: 284,
      plates: [
        { x: 276, z: -3 },
        { x: 276, z: 3 },
      ],
    },
    {
      x: 345,
      plates: [
        { x: 335, z: -3 },
        { x: 335, z: -1 },
        { x: 335, z: 1 },
        { x: 335, z: 3 },
      ],
    },
  ],
  holdSeconds: 1.2,
  plateRadius: 0.95,
} as const;

export const SURFACES: readonly Box[] = [
  // Site gate: solid ground, room to work out who stands where.
  box('yard', 'yard', -6, 16, -1.2, 0, -9, 9),
  box('crate-a', 'crate', 6, 7.6, 0, 0.9, -3.2, -1.6),
  box('crate-b', 'crate', 10, 11.6, 0, 0.9, 1.4, 3.0),

  // Girder run: three beams over the pit with two jumpable gaps.
  box('girder-a', 'girder', 16, 24, -0.5, 0, -0.9, 0.9),
  box('girder-b', 'girder', 26.7, 33, -0.5, 0, -0.15, 1.25),
  box('girder-c', 'girder', 36, 44, -0.5, 0, -1.25, 0.15),

  // The low road: drop under the gaps and walk, then climb back out on the
  // left of the girders, where there is headroom to jump.
  box('catwalk', 'catwalk', 22, 28, -2.9, -2.4, -2.8, -1.1),
  box('catwalk-turn', 'catwalk', 28, 30, -2.9, -2.4, -2.8, 1.3),
  box('catwalk-return', 'catwalk', 30, 34, -2.9, -2.4, -0.4, 1.3),
  box('catwalk-turn-back', 'catwalk', 34, 36, -2.9, -2.4, -2.8, 1.3),
  box('catwalk-exit', 'catwalk', 36, 40, -2.9, -2.4, -2.8, -1.1),
  box('step-a', 'crate', 39.4, 41.4, -2.4, -1.6, -2.9, -1.3),
  box('step-b', 'crate', 41.4, 43.4, -1.6, -0.8, -2.9, -1.3),
  box('step-c', 'crate', 43.4, 45.4, -0.8, 0, -2.9, -1.3),

  // Scaffold climb: six short steps up to the high structure.
  box('scaffold-base', 'scaffold', 44, 50, -0.5, 0, -4, 4),
  box('scaffold-1', 'scaffold', 50.0, 52.5, 0.7, 1.2, -2.4, 1.3),
  box('scaffold-2', 'scaffold', 52.5, 55.0, 1.9, 2.4, -1.3, 2.4),
  box('scaffold-3', 'scaffold', 55.0, 57.5, 3.1, 3.6, -2.4, 1.3),
  box('scaffold-4', 'scaffold', 57.5, 60.0, 4.3, 4.8, -1.3, 2.4),
  box('scaffold-5', 'scaffold', 60.0, 62.5, 5.5, 6.0, -2.4, 1.3),
  box('scaffold-6', 'scaffold', 62.5, 65.0, 6.7, 7.2, -1.3, 2.4),
  box('scaffold-top', 'scaffold', 65, 70, 7.5, 8.0, -3, 3),

  // Pendulum ledge: narrow, high, and swept by the wrecking load.
  box('ledge', 'ledge', 76, 92, 7.5, 8.0, -2, 2),

  // Crate stack at the pipe mouth: the only way up onto the roof, and set to
  // one side so it never blocks the doorway.
  box('pipe-crate', 'crate', 89.0, 91.5, 8.0, 9.0, 0.4, 1.4),

  // Pipe crawl: headroom for walking, none for jumping, and single file only.
  box('pipe-floor', 'pipe', 92, 112, 7.5, 8.0, -1.0, 1.0),
  box('pipe-wall-l', 'pipe', 92, 112, 8.0, 9.75, -1.4, -1.0),
  box('pipe-wall-r', 'pipe', 92, 112, 8.0, 9.75, 1.0, 1.4),

  // The roof is the fast way over the top, with a hole punched through it.
  box('pipe-roof-a', 'pipe-roof', 92, 104, 9.75, 10.05, -1.4, 1.4),
  box('pipe-roof-b', 'pipe-roof', 106.4, 112, 9.75, 10.05, -1.4, 1.4),

  // Net approach and the ground the net reaches down to.
  box('net-deck', 'ledge', 112, 118, 7.5, 8.0, -3, 3),
  box('lower-pad', 'pad', 118, 125, -1.2, 0, -4, 4),
  box('cargo-landing', 'pad', 136, 144, -1.2, 0, -4, 4),

  // Cargo chicane: jump the loads or take the slower route around the ends.
  box('cargo-left', 'crate', 138, 138.7, 0, 2.5, -4, 0.4),
  box('cargo-right', 'crate', 141, 141.7, 0, 2.5, -0.4, 4),
  // One last narrow crossing. The landing is wide enough to regroup.
  box('last-bridge-a', 'ledge', 144, 151, -0.5, 0, -1.1, 1.1),
  box('last-bridge-b', 'ledge', 153.5, 161, -0.5, 0, -1.1, 1.1),

  // Site office.
  box('office-pad', 'office', 161, COURSE_END_X, -1.2, 0, -8, 8),

  // Separate Switchyard route: two gated banks and exposed spans.
  box('switch-start', 'yard', 260, 284, -1.2, 0, -6, 6),
  box('switch-gate-one-landing', 'ledge', 284, 292, -0.5, 0, -4, 4),
  box('switch-span-a', 'girder', 294.5, 304, -0.5, 0, -1.5, 1.5),
  box('switch-span-b', 'girder', 306.5, 316, -0.5, 0, -1.5, 1.5),
  box('switch-regroup', 'pad', 316, 326, -1.2, 0, -6, 6),
  box('switch-bank', 'yard', 326, 345, -1.2, 0, -6, 6),
  box('switch-gate-two-landing', 'ledge', 345, 354, -0.5, 0, -4, 4),
  box('switch-final-span', 'girder', 356.5, 363, -0.5, 0, -1.6, 1.6),
  box('switch-finish', 'office', 363, SWITCHYARD.endX, -1.2, 0, -7, 7),
];

/** Solid props use the same bounds in rendering and collision. */
export const PROPS: readonly Box[] = [
  box('office-building', 'office', FINISH_X + 1, FINISH_X + 6, 0, 3, -3.5, 3.5),
  box(
    'switch-office-building',
    'office',
    SWITCHYARD.finishX + 1,
    SWITCHYARD.finishX + 6,
    0,
    3,
    -3.5,
    3.5,
  ),
  ...SURFACES.filter(
    (b) => b.kind === 'scaffold' && b.id !== 'scaffold-base',
  ).flatMap((b) => [
    ...[b.minX + 0.1, b.maxX - 0.1].flatMap((x, i) =>
      [b.minZ + 0.1, b.maxZ - 0.1].map((z, j) =>
        box(
          `${b.id}-post-${i}-${j}`,
          'pipe',
          x - 0.09,
          x + 0.09,
          -1.2,
          b.maxY + 1.1,
          z - 0.09,
          z + 0.09,
        ),
      ),
    ),
    box(
      `${b.id}-rail`,
      'pipe',
      b.minX + 0.1,
      b.maxX - 0.1,
      b.maxY + 0.94,
      b.maxY + 1.06,
      b.minZ + 0.04,
      b.minZ + 0.16,
    ),
  ]),
];

export const SOLIDS: readonly Box[] = [...SURFACES, ...PROPS];

/** Shared render/physics transforms. The deck shuttles between stable docks;
 * suspended loads traverse open crossings with a visible, learnable rhythm. */
export function machineryAt(seconds: number): Box[] {
  const shuttle = Math.sin((seconds * Math.PI) / 5) * 1.7;
  const sweep = Math.sin((seconds * Math.PI) / 3.6) * 4.5;
  return [
    box(
      'cargo-shuttle',
      'pad',
      126 + shuttle,
      134 + shuttle,
      -0.6,
      0,
      -1.55,
      1.55,
    ),
    box(
      'sweep-final',
      'crate',
      156.2,
      157.2,
      0.25,
      2.4,
      sweep - 0.7,
      sweep + 0.7,
    ),
    box(
      'sweep-scaffold',
      'crate',
      66.5,
      67.4,
      8.2,
      10.4,
      Math.sin((seconds * Math.PI) / 4.4 + 1.6) * 4.8 - 0.65,
      Math.sin((seconds * Math.PI) / 4.4 + 1.6) * 4.8 + 0.65,
    ),
  ];
}

export function courseSeconds(world: {
  clock: number;
  startedAt: number;
  endedAt?: number;
}): number {
  return Math.max(0, ((world.endedAt || world.clock) - world.startedAt) / 1000);
}

export function courseSolids(world: {
  clock: number;
  startedAt: number;
  endedAt?: number;
}): readonly Box[] {
  return [...SOLIDS, ...machineryAt(courseSeconds(world))];
}

export type Anchor = {
  id: string;
  x: number;
  y: number;
  z: number;
  label: string;
};

/** Rings the safety line can clip to, turning that link into a fixed pivot. */
export const ANCHORS: readonly Anchor[] = [
  { id: 'ring-gap-1', x: 23.4, y: 0.3, z: 0, label: 'First gap' },
  { id: 'ring-gap-2', x: 32.4, y: 0.3, z: 0, label: 'Second gap' },
  { id: 'ring-plank-near', x: 69.6, y: 8.3, z: 0, label: 'Plank near end' },
  { id: 'ring-plank-far', x: 76.4, y: 8.3, z: 0, label: 'Plank far end' },
  { id: 'ring-pipe', x: 91.2, y: 8.3, z: 0, label: 'Pipe mouth' },
  { id: 'ring-net', x: 117.4, y: 8.3, z: 0, label: 'Net head' },
  { id: 'ring-last-near', x: 150.2, y: 0.3, z: 0, label: 'Final gap' },
  { id: 'ring-last-far', x: 154.3, y: 0.3, z: 0, label: 'Final landing' },
  { id: 'switch-ring-a', x: 290.5, y: 0.3, z: 0, label: 'First crossing' },
  { id: 'switch-ring-b', x: 315.0, y: 0.3, z: 0, label: 'Regroup landing' },
  { id: 'switch-ring-c', x: 352.5, y: 0.3, z: 0, label: 'Final crossing' },
];

export type Checkpoint = {
  index: number;
  x: number;
  spawn: [number, number, number];
  label: string;
};

export const CHECKPOINTS: readonly Checkpoint[] = [
  { index: 0, x: -6, spawn: [2, 0.1, 0], label: 'Site gate' },
  { index: 1, x: 16, spawn: [17.5, 0.1, 0], label: 'Girder run' },
  { index: 2, x: 44, spawn: [46, 0.1, 0], label: 'Scaffold foot' },
  { index: 3, x: 65, spawn: [67, 8.1, 0], label: 'Scaffold top' },
  { index: 4, x: 76, spawn: [78, 8.1, 0], label: 'Wrecking ledge' },
  { index: 5, x: 92, spawn: [93.5, 8.1, 0], label: 'Pipe mouth' },
  { index: 6, x: 112, spawn: [114, 8.1, 0], label: 'Net head' },
  { index: 7, x: 118, spawn: [121, 0.1, 0], label: 'Lower pad' },
  { index: 8, x: 144, spawn: [146, 0.1, 0], label: 'Last crossing' },
  { index: 9, x: 161, spawn: [163, 0.1, 0], label: 'Office approach' },
];

export const SWITCHYARD_CHECKPOINTS: readonly Checkpoint[] = [
  { index: 0, x: 260, spawn: [265, 0.1, 0], label: 'Switchyard entrance' },
  { index: 1, x: 284, spawn: [287, 0.1, 0], label: 'First gate' },
  { index: 2, x: 316, spawn: [320, 0.1, 0], label: 'Regroup deck' },
  { index: 3, x: 345, spawn: [349, 0.1, 0], label: 'Crew gate' },
  { index: 4, x: 363, spawn: [366, 0.1, 0], label: 'Office landing' },
];

export function checkpointsFor(mapId: MapId): readonly Checkpoint[] {
  return mapId === 'switchyard' ? SWITCHYARD_CHECKPOINTS : CHECKPOINTS;
}

export function finishXFor(mapId: MapId): number {
  return mapId === 'switchyard' ? SWITCHYARD.finishX : FINISH_X;
}

export function endXFor(mapId: MapId): number {
  return mapId === 'switchyard' ? SWITCHYARD.endX : COURSE_END_X;
}

/**
 * Where across the course a worker wants to be at this point: the middle,
 * except where the obvious line runs somewhere else.
 */
export function laneZ(
  x: number,
  y: number,
  mapId: MapId = 'demolition',
): number {
  if (mapId === 'switchyard') return 0;
  // Climbing out of the low road happens beside the girders, not under them.
  if (y < -1.0 && x > 34 && x < 46) return -2.1;
  if (y < -1.0 && x >= 22 && x < 29) return -1.9;
  if (y < -1.0 && x >= 29 && x < 34) return 0.4;
  if (y > -1 && x > 24 && x < 33) return 0.55;
  if (y > -1 && x >= 33 && x < 43) return -0.55;
  if (x >= 136 && x < 139.3) return 1.35;
  if (x >= 139.3 && x < 142.3) return -1.35;
  // Past the crate stack at the pipe mouth and into the pipe.
  if (x > 86 && x < 92.5) return -0.4;
  return 0;
}

/** Course section a worker is standing in, used for milestones and the HUD. */
export function sectionAt(x: number, mapId: MapId = 'demolition'): string {
  if (mapId === 'switchyard') {
    if (x < 284) return 'switch-pair';
    if (x < 316) return 'switch-spans';
    if (x < 345) return 'switch-crew';
    if (x < 363) return 'switch-final';
    return x < SWITCHYARD.finishX ? 'switch-office' : 'office';
  }
  if (x < 16) return 'gate';
  if (x < 44) return 'girders';
  if (x < 70) return 'scaffold';
  if (x < 76) return 'plank';
  if (x < 92) return 'wrecking';
  if (x < 112) return 'pipe';
  if (x < 118) return 'net';
  if (x < 144) return 'yard-run';
  if (x < 161) return 'last-crossing';
  if (x < FINISH_X) return 'office-approach';
  return 'office';
}

export function checkpointAt(x: number, mapId: MapId = 'demolition'): number {
  let index = 0;
  for (const point of checkpointsFor(mapId))
    if (x >= point.x) index = point.index;
  return index;
}

export function checkpoint(
  index: number,
  mapId: MapId = 'demolition',
): Checkpoint {
  const points = checkpointsFor(mapId);
  return points[Math.max(0, Math.min(points.length - 1, index))];
}

/** Surface height of the tipping plank at a given x, for the given tilt. */
export function plankSurfaceY(x: number, tilt: number): number {
  return PLANK.y + Math.tan(tilt) * (x - PLANK.pivotX);
}

export function onPlank(x: number, z: number, tilt = 0): boolean {
  return (
    x >= PLANK.pivotX - PLANK.halfLength * Math.cos(tilt) &&
    x <= PLANK.pivotX + PLANK.halfLength * Math.cos(tilt) &&
    z >= PLANK.minZ &&
    z <= PLANK.maxZ
  );
}

/** Where the wrecking ball is for a given swing angle. */
export function pendulumBall(angle: number): [number, number, number] {
  return [
    PENDULUM.pivotX,
    PENDULUM.pivotY - Math.cos(angle) * PENDULUM.ropeLength,
    Math.sin(angle) * PENDULUM.ropeLength,
  ];
}

export function nearNet(x: number, y: number, z: number): boolean {
  return (
    Math.abs(x - NET.x) <= NET.reach &&
    y >= NET.minY - 0.2 &&
    y <= NET.maxY &&
    z >= NET.minZ &&
    z <= NET.maxZ
  );
}
