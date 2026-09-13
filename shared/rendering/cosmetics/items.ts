import type { Slot } from '../../wardrobe/catalog';

type Vec = [number, number, number];

/**
 * Where a part is placed:
 * - `head`: on the body, measured from the top centre of the head
 * - `face`: on the body, measured from the centre of the face
 * - `body`: on the body, in the worker's own coordinates
 * - `legs` and `arms`: on each leg or arm, from its joint, mirrored left and right
 */
export type Anchor = 'head' | 'face' | 'body' | 'legs' | 'arms';

type Base = { on: Anchor; at: Vec; colour: string; turn?: Vec };
export type Part =
  | (Base & { shape: 'box'; size: Vec; rounded?: boolean })
  | (Base & { shape: 'ball'; size: Vec })
  | (Base & {
      shape: 'taper';
      top: number;
      bottom: number;
      height: number;
      sides?: number;
    });

export type ItemModel = {
  slot: Slot;
  /** Recolours the worker's trousers and bib. */
  overalls?: string;
  /** Recolours the worker's boots. */
  boots?: string;
  parts: Part[];
};

/** A part in this colour takes the wearer's player colour. */
export const PLAYER = 'player';

const QUARTER = Math.PI / 2;
const cube = (
  on: Anchor,
  size: Vec,
  at: Vec,
  colour: string,
  extra: { rounded?: boolean; turn?: Vec } = {},
): Part => ({ shape: 'box', on, size, at, colour, ...extra });
const orb = (
  on: Anchor,
  size: Vec,
  at: Vec,
  colour: string,
  turn?: Vec,
): Part => ({ shape: 'ball', on, size, at, colour, turn });
const cone = (
  on: Anchor,
  [top, bottom, height]: Vec,
  at: Vec,
  colour: string,
  extra: { sides?: number; turn?: Vec } = {},
): Part => ({ shape: 'taper', on, top, bottom, height, at, colour, ...extra });

/** Every wardrobe item's model, by catalog id. */
export const ITEM_MODELS: Record<string, ItemModel> = {
  'bobble-beanie': {
    slot: 'hat',
    parts: [
      cube('head', [0.56, 0.22, 0.54], [0, 0.07, 0], PLAYER, { rounded: true }),
      cube('head', [0.57, 0.05, 0.55], [0, 0.1, 0], '#2f4858'),
      orb('head', [0.08, 0.08, 0.08], [0, 0.21, 0], '#ffffff'),
    ],
  },
  'party-cone': {
    slot: 'hat',
    parts: [
      cone('head', [0, 0.22, 0.42], [0, 0.21, 0], PLAYER, { sides: 12 }),
      cone('head', [0.155, 0.175, 0.05], [0, 0.1, 0], '#fff3c4', {
        sides: 12,
      }),
      orb('head', [0.05, 0.05, 0.05], [0, 0.43, 0], '#fff3c4'),
    ],
  },
  'top-hat': {
    slot: 'hat',
    parts: [
      cone('head', [0.36, 0.36, 0.04], [0, 0.02, 0], '#2b2b33', { sides: 16 }),
      cone('head', [0.21, 0.21, 0.34], [0, 0.21, 0], '#2b2b33', { sides: 16 }),
      cone('head', [0.215, 0.215, 0.06], [0, 0.08, 0], PLAYER, { sides: 16 }),
    ],
  },
  'viking-helmet': {
    slot: 'hat',
    parts: [
      orb('head', [0.3, 0.2, 0.29], [0, 0, 0], '#8d949b'),
      cube('head', [0.62, 0.06, 0.6], [0, -0.01, 0], '#b8863f'),
      cone('head', [0, 0.055, 0.26], [0.33, 0.12, 0], '#f1e6c8', {
        turn: [0, 0, -0.55],
      }),
      cone('head', [0, 0.055, 0.26], [-0.33, 0.12, 0], '#f1e6c8', {
        turn: [0, 0, 0.55],
      }),
    ],
  },
  'champion-hard-hat': {
    slot: 'hat',
    parts: [
      cube('head', [0.74, 0.1, 0.72], [0, 0.02, 0.04], '#e9b93f', {
        rounded: true,
      }),
      cube('head', [0.6, 0.28, 0.56], [0, 0.18, 0], '#e9b93f', {
        rounded: true,
      }),
      cube('head', [0.1, 0.32, 0.58], [0, 0.2, 0], '#fff1b8', {
        rounded: true,
      }),
      cube('head', [0.16, 0.14, 0.03], [0, 0.16, 0.29], '#d8573a'),
    ],
  },
  'striped-tee': {
    slot: 'top',
    parts: [
      cube('body', [0.68, 0.055, 0.44], [0, 0.86, 0], '#f6efdf'),
      cube('body', [0.68, 0.055, 0.44], [0, 1.06, 0], '#f6efdf'),
      cube('arms', [0.23, 0.05, 0.29], [0, -0.04, 0], '#f6efdf'),
    ],
  },
  'bow-tie': {
    slot: 'top',
    parts: [
      cube('body', [0.46, 0.07, 0.3], [0, 1.21, 0.07], '#f6efdf'),
      cube('body', [0.22, 0.1, 0.05], [0, 1.12, 0.24], '#c23b4a'),
      cube('body', [0.06, 0.07, 0.06], [0, 1.12, 0.26], '#8f2433'),
    ],
  },
  'hero-cape': {
    slot: 'top',
    parts: [
      cube('body', [0.72, 0.92, 0.04], [0, 0.76, -0.26], PLAYER, {
        turn: [0.12, 0, 0],
      }),
      cube('body', [0.74, 0.09, 0.32], [0, 1.2, -0.1], PLAYER),
      orb('body', [0.05, 0.05, 0.03], [0, 1.17, 0.22], '#e7c04f'),
    ],
  },
  'badge-sash': {
    slot: 'top',
    parts: [
      cube('body', [0.14, 0.96, 0.45], [0, 0.88, 0], '#3f6fb5', {
        turn: [0, 0, 0.72],
      }),
      cube('body', [0.1, 0.1, 0.03], [-0.08, 0.97, 0.235], '#f2c14e'),
    ],
  },
  'denim-overalls': {
    slot: 'legs',
    overalls: '#34507e',
    parts: [
      cube('body', [0.13, 0.1, 0.02], [0, 0.9, 0.285], '#f1ead6'),
      cube('legs', [0.26, 0.05, 0.3], [0, -0.33, 0], '#2b4063'),
    ],
  },
  'cargo-trousers': {
    slot: 'legs',
    overalls: '#857b52',
    parts: [cube('legs', [0.05, 0.12, 0.14], [0.13, -0.16, 0], '#6d6441')],
  },
  'plaid-trousers': {
    slot: 'legs',
    overalls: '#8a3a3a',
    parts: [
      cube('legs', [0.25, 0.03, 0.29], [0, -0.12, 0], '#2f2626'),
      cube('legs', [0.03, 0.39, 0.29], [0, -0.18, 0], '#2f2626'),
    ],
  },
  'rain-boots': {
    slot: 'shoes',
    boots: '#3f8c4e',
    parts: [cube('legs', [0.32, 0.06, 0.45], [0, -0.31, 0.065], '#2d6a3a')],
  },
  'high-tops': {
    slot: 'shoes',
    boots: '#f2eee4',
    parts: [
      cube('legs', [0.31, 0.1, 0.3], [0, -0.29, 0], '#c8483a'),
      cube('legs', [0.31, 0.05, 0.44], [0, -0.475, 0.065], '#2a2a2a'),
    ],
  },
  'clown-shoes': {
    slot: 'shoes',
    boots: '#d7433a',
    parts: [orb('legs', [0.17, 0.11, 0.2], [0, -0.39, 0.3], '#d7433a')],
  },
  'rocket-boots': {
    slot: 'shoes',
    boots: '#c3c9cf',
    parts: [
      cone('legs', [0.07, 0.02, 0.16], [0, -0.42, -0.24], '#ff6a2a', {
        turn: [QUARTER, 0, 0],
      }),
      cube('legs', [0.04, 0.1, 0.2], [0.15, -0.38, 0], '#d7433a'),
    ],
  },
  'round-glasses': {
    slot: 'face',
    parts: [0.12, -0.12].flatMap((x): Part[] => [
      cone('face', [0.085, 0.085, 0.02], [x, 0.02, 0.03], '#2b2b2b', {
        sides: 16,
        turn: [QUARTER, 0, 0],
      }),
      cone('face', [0.068, 0.068, 0.02], [x, 0.02, 0.036], '#dfeef2', {
        sides: 16,
        turn: [QUARTER, 0, 0],
      }),
    ]),
  },
  'big-moustache': {
    slot: 'face',
    parts: [
      orb(
        'face',
        [0.12, 0.045, 0.05],
        [0.075, -0.135, 0.07],
        '#4a3326',
        [0, 0, 0.3],
      ),
      orb(
        'face',
        [0.12, 0.045, 0.05],
        [-0.075, -0.135, 0.07],
        '#4a3326',
        [0, 0, -0.3],
      ),
    ],
  },
  'snorkel-mask': {
    slot: 'face',
    parts: [
      cube('face', [0.48, 0.2, 0.04], [0, 0.02, 0.025], '#f2d14b'),
      cube('face', [0.4, 0.13, 0.05], [0, 0.02, 0.03], '#9fd8ef'),
      cone('face', [0.025, 0.025, 0.42], [0.29, 0.14, -0.05], '#f2d14b'),
      cube('face', [0.1, 0.05, 0.05], [0.21, -0.12, 0.07], '#f2d14b'),
    ],
  },
  'star-shades': {
    slot: 'face',
    parts: [0.12, -0.12].flatMap((x): Part[] => [
      cube('face', [0.13, 0.13, 0.02], [x, 0.02, 0.035], '#e94f8a'),
      cube('face', [0.13, 0.13, 0.02], [x, 0.02, 0.037], '#e94f8a', {
        turn: [0, 0, Math.PI / 4],
      }),
    ]),
  },
};
