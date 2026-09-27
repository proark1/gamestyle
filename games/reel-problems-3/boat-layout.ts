export const BOAT_LAYOUT = {
  deck: {
    halfWidth: 2.92,
    halfLength: 3.58,
    innerHalfWidth: 2.62,
    innerHalfLength: 3.22,
  },
  portX: -2.98,
  starboardX: 2.98,
  gate: {
    x: 2.98,
    z: 0,
    width: 1.82,
    thresholdX: 2.68,
  },
  gangway: {
    x: 3.9,
    z: 0,
    width: 1.72,
    depth: 2.45,
  },
  cabin: { x: -0.35, z: -2.72, width: 2.1, depth: 1.08 },
  engine: { x: 0.05, z: 2.94, width: 2.05, depth: 0.68 },
  iceHold: { x: 1.88, z: 1.72, width: 0.84, depth: 1.02 },
  mast: { x: 1.92, z: -0.92, radius: 0.18 },
  fishLanding: { x: 1.55, z: 0.15, width: 1.25, depth: 1.35 },
  spawns: [
    { x: -1.35, z: 0.55 },
    { x: -0.45, z: 0.55 },
    { x: 0.45, z: 0.55 },
    { x: 1.35, z: 0.55 },
  ],
  idle: [
    { x: -1.75, z: -0.75 },
    { x: -1.65, z: 1.5 },
    { x: 0.25, z: 1.55 },
    { x: 1.25, z: -1.55 },
  ],
} as const;

export const STARBOARD_RAIL_SEGMENTS = [
  {
    z: -(BOAT_LAYOUT.deck.halfLength + BOAT_LAYOUT.gate.width / 2) / 2,
    depth: BOAT_LAYOUT.deck.halfLength - BOAT_LAYOUT.gate.width / 2,
  },
  {
    z: (BOAT_LAYOUT.deck.halfLength + BOAT_LAYOUT.gate.width / 2) / 2,
    depth: BOAT_LAYOUT.deck.halfLength - BOAT_LAYOUT.gate.width / 2,
  },
] as const;

export const BOAT_FIXTURES = [
  { id: 'wheel-house', ...BOAT_LAYOUT.cabin },
  { id: 'engine-box', ...BOAT_LAYOUT.engine },
  { id: 'ice-hold', ...BOAT_LAYOUT.iceHold },
  {
    id: 'mast',
    x: BOAT_LAYOUT.mast.x,
    z: BOAT_LAYOUT.mast.z,
    radius: BOAT_LAYOUT.mast.radius,
  },
] as const;
