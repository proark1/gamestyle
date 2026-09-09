import { sofaShapes, type ShapeBox } from '../../shared/physics/sofa';
export { PLAYER_RADIUS, PLAYER_HEIGHT } from '../../shared/physics/sofa';
export type { ShapeBox } from '../../shared/physics/sofa';
import { GOAL, ITEMS, type Kind } from './types';

export const FLOOR = 0.13;
const shape = (
  size: ShapeBox['size'],
  pos: ShapeBox['pos'],
  color: string,
  rounded = false,
): ShapeBox => ({ size, pos, color, rounded });
/** These boxes are both the visible mesh and the collision shape. */
export function salvageShapes(kind: Kind): ShapeBox[] {
  const { w, h, d, color } = ITEMS[kind];
  if (kind === 'crate' || kind === 'fridge')
    return [shape([w, h, d], [0, h / 2, 0], color, true)];
  if (kind === 'plank') return [shape([w, h, d], [0, h / 2, 0], color)];
  if (kind === 'pallet')
    return [
      ...[-0.8, -0.4, 0, 0.4, 0.8].map((z) =>
        shape([w, 0.13, 0.4], [0, h - 0.065, z], color),
      ),
      ...[-0.85, 0, 0.85].map((x) =>
        shape([0.25, 0.32, d], [x, 0.16, 0], '#957445'),
      ),
    ];
  if (kind === 'sofa') return sofaShapes({ w, h, d, color });
  return [
    shape([w, 0.38, d], [0, 0.19, 0], color, true),
    ...[-0.55, 0.55].map((z) =>
      shape([w, 0.47, 0.2], [0, 0.615, z], color, true),
    ),
    ...[-1.14, 1.14].map((x) =>
      shape([0.22, 0.47, d], [x, 0.615, 0], color, true),
    ),
    shape([1.9, 0.04, 0.86], [0, 0.4, 0], '#75aaa5'),
  ];
}

export const RESCUE_ENTRY_WIDTH = 1.8;
const rescueRailLength = (4.5 - RESCUE_ENTRY_WIDTH) / 2;
const rescueRailOffset = (RESCUE_ENTRY_WIDTH + rescueRailLength) / 2;

export const CRANE = {
  mastX: 7.85,
  mastZ: -6.5,
  boomY: GOAL + 4.3,
  frameY: GOAL + 2.9,
  slingY: GOAL + 3.8,
};
// The cargo crane slews independently above the fixed rescue crane. Its mast
// sits at the left edge and its trolley can reach the whole cargo work area.
export const LOAD_CRANE = {
  mastX: -9.3,
  mastZ: 0,
  boomY: GOAL + 7.5,
  reach: 20.5,
};
const mastDistance = Math.hypot(CRANE.mastX, CRANE.mastZ);
const boomCenter = (mastDistance + 1.5 - 1) / 2;
export type SceneryShape = ShapeBox & { rotationY?: number };

export const SCENERY: SceneryShape[] = [
  { ...shape([21, 1.1, 21], [0, FLOOR - 0.55, 0], '#a5b396'), id: 'ground' },
  { ...shape([3.9, 2.6, 2.8], [-7, 1.3, -7], '#7f9b88', true), id: 'shed' },
  { ...shape([4.4, 0.22, 3.25], [-7, 2.72, -7], '#466c60'), id: 'shed-roof' },
  {
    ...shape(
      [1.4, 0.26, 1.8],
      [LOAD_CRANE.mastX, FLOOR + 0.13, LOAD_CRANE.mastZ],
      '#778f80',
    ),
    id: 'load-crane-base',
  },
  ...[-0.45, 0.45].flatMap((x) =>
    [-0.55, 0.55].map((z) => ({
      ...shape(
        [0.18, LOAD_CRANE.boomY, 0.18],
        [LOAD_CRANE.mastX + x, LOAD_CRANE.boomY / 2, LOAD_CRANE.mastZ + z],
        '#75978a',
      ),
      id: 'load-crane-post',
    })),
  ),
  {
    ...shape(
      [1.5, 0.3, 1.7],
      [LOAD_CRANE.mastX, LOAD_CRANE.boomY, LOAD_CRANE.mastZ],
      '#527b70',
    ),
    id: 'load-crane-turntable',
  },
  ...[6.9, 8.8].map((x) => ({
    ...shape(
      [0.24, CRANE.boomY, 0.24],
      [x, CRANE.boomY / 2, CRANE.mastZ],
      '#d5a33c',
    ),
    id: 'crane-post',
  })),
  {
    ...shape(
      [2.3, 0.3, 1.9],
      [CRANE.mastX, CRANE.boomY, CRANE.mastZ],
      '#d5a33c',
    ),
    id: 'crane-turntable',
  },
  {
    ...shape(
      [mastDistance + 2.5, 0.38, 0.5],
      [
        (boomCenter * CRANE.mastX) / mastDistance,
        CRANE.boomY,
        (boomCenter * CRANE.mastZ) / mastDistance,
      ],
      '#e5b343',
    ),
    rotationY: Math.atan2(-CRANE.mastZ, CRANE.mastX),
    id: 'crane-beam',
  },
  // A spreader frame gives all four corner cables a real attachment while
  // keeping the center entrances and standing headroom clear.
  ...[-2, 2].flatMap((edge) => [
    {
      ...shape([4.2, 0.16, 0.16], [0, CRANE.frameY, edge], '#c09236'),
      id: 'rescue-spreader',
    },
    {
      ...shape([0.16, 0.16, 4.2], [edge, CRANE.frameY, 0], '#c09236'),
      id: 'rescue-spreader',
    },
  ]),
  {
    ...shape([0.28, 0.28, 0.28], [0, CRANE.slingY, 0], '#526c60'),
    id: 'rescue-hoist-joint',
  },
  {
    ...shape([1.4, 1.2, 1.4], [7.8, 14.7, -6.1], '#d1a74f', true),
    id: 'crane-cabin',
  },
  {
    ...shape([4.7, 0.28, 4.7], [0, GOAL - 0.14, 0], '#f0ce75'),
    id: 'rescue-platform',
  },
  // Leave a player-wide entrance on every approach. Full side rails trapped
  // jumps that cleared the deck on the narrow outer rim below the rail tops.
  ...[-2.2, 2.2].flatMap((x) =>
    [-rescueRailOffset, rescueRailOffset].map((z) => ({
      ...shape([0.08, 0.8, rescueRailLength], [x, GOAL + 0.44, z], '#c09236'),
      id: 'rescue-rail',
    })),
  ),
  ...[-rescueRailOffset, rescueRailOffset].map((x) => ({
    ...shape([rescueRailLength, 0.8, 0.08], [x, GOAL + 0.44, -2.2], '#c09236'),
    id: 'rescue-rail',
  })),
];

export const PIECE_MASS: Record<Kind, number> = {
  crate: 30,
  pallet: 18,
  plank: 12,
  sofa: 42,
  bathtub: 55,
  fridge: 65,
};
