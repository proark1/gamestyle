import type { Anchor, ItemModel, Part } from './items';

type Vec = [number, number, number];
const orb = (on: Anchor, size: Vec, at: Vec, colour: string): Part => ({
  shape: 'ball',
  on,
  size,
  at,
  colour,
});
const box = (on: Anchor, size: Vec, at: Vec, colour: string): Part => ({
  shape: 'box',
  on,
  size,
  at,
  colour,
  rounded: true,
});
const disc = (
  on: Anchor,
  radius: number,
  height: number,
  at: Vec,
  colour: string,
  turn?: Vec,
): Part => ({
  shape: 'taper',
  on,
  top: radius,
  bottom: radius,
  height,
  at,
  colour,
  sides: 24,
  turn,
});

/** Lightweight worker versions; the kid and shop share the detailed clay models. */
export const PLAYFUL_MODELS: Record<string, ItemModel> = {
  'ramen-nest': {
    slot: 'hat',
    parts: [
      orb('head', [0.32, 0.14, 0.3], [0, 0.1, 0], '#fff0ce'),
      orb('head', [0.2, 0.025, 0.16], [0, 0.2, 0], '#f4c96f'),
      box('head', [0.025, 0.3, 0.025], [-0.13, 0.31, -0.02], '#704b38'),
      box('head', [0.025, 0.3, 0.025], [0.13, 0.31, -0.02], '#704b38'),
    ],
  },
  'mini-volcano': {
    slot: 'hat',
    parts: [
      disc('head', 0.31, 0.08, [0, 0.05, 0], '#343741'),
      {
        shape: 'taper',
        on: 'head',
        top: 0.08,
        bottom: 0.28,
        height: 0.34,
        at: [0, 0.25, 0],
        colour: '#55505a',
        sides: 12,
      },
      orb('head', [0.08, 0.03, 0.07], [0, 0.4, 0], '#f8794f'),
      orb('head', [0.055, 0.04, 0.05], [0.03, 0.45, 0], '#a3a1ad'),
    ],
  },
  'sharkfin-zip-up': {
    slot: 'top',
    shirt: '#246c77',
    parts: [
      box('body', [0.04, 0.34, 0.025], [0, 0.76, 0.29], '#dcebd9'),
      ...[-1, 1].map((side) =>
        box('body', [0.055, 0.065, 0.025], [side * 0.17, 0.8, 0.27], '#b9e5dc'),
      ),
      {
        shape: 'taper',
        on: 'body',
        top: 0,
        bottom: 0.17,
        height: 0.32,
        at: [0, 0.79, -0.29],
        colour: '#19616d',
        sides: 3,
      },
    ],
  },
  'arcade-bomber': {
    slot: 'top',
    shirt: '#302858',
    parts: [
      box('body', [0.55, 0.055, 0.38], [0, 0.58, 0], '#f59d68'),
      ...['#69e7d2', '#f8ca67', '#f477a1'].map((colour, i) =>
        box('body', [0.08, 0.08, 0.04], [-0.16 + i * 0.16, 0.8, 0.29], colour),
      ),
    ],
  },
  'balloon-twist-pants': {
    slot: 'legs',
    overalls: '#efaa99',
    parts: [
      orb('legs', [0.15, 0.18, 0.14], [0, -0.12, 0], '#f3a8aa'),
      orb('legs', [0.15, 0.17, 0.14], [0, -0.31, 0], '#7bd2dc'),
    ],
  },
  'lava-flow-joggers': {
    slot: 'legs',
    overalls: '#3b3a41',
    parts: [
      box('legs', [0.29, 0.055, 0.29], [0, -0.43, 0], '#57505a'),
      box('legs', [0.035, 0.3, 0.025], [0.03, -0.23, 0.16], '#fff0ce'),
    ],
  },
  'banana-peel-slides': {
    slot: 'shoes',
    boots: '#f7d95a',
    parts: [
      box('legs', [0.31, 0.05, 0.43], [0, -0.48, 0.055], '#7d6042'),
      box('legs', [0.08, 0.035, 0.19], [0.1, -0.4, 0.22], '#fff1be'),
    ],
  },
  'wind-up-stompers': {
    slot: 'shoes',
    boots: '#704230',
    parts: [
      box('legs', [0.32, 0.06, 0.45], [0, -0.48, 0.05], '#163867'),
      box('legs', [0.025, 0.17, 0.17], [0.17, -0.36, 0], '#fff0ce'),
    ],
  },
  'side-eye-specs': {
    slot: 'face',
    parts: [-1, 1].flatMap((side) => [
      orb('face', [0.092, 0.085, 0.038], [side * 0.14, 0.02, 0.1], '#fff6df'),
      orb('face', [0.035, 0.04, 0.016], [side * 0.18, 0.02, 0.143], '#263b30'),
    ]),
  },
  'bubble-beard': {
    slot: 'beard',
    parts: [
      orb('face', [0.1, 0.08, 0.065], [0, -0.22, 0.08], '#e5f5ee'),
      ...[-1, 1].flatMap((side) => [
        orb('face', [0.075, 0.07, 0.055], [side * 0.1, -0.18, 0.07], '#aee9d9'),
      ]),
      orb('face', [0.06, 0.06, 0.05], [0.05, -0.29, 0.06], '#fff7e5'),
    ],
  },
  'neon-visor': {
    slot: 'hat',
    parts: [
      disc('head', 0.32, 0.06, [0, 0.09, 0], '#182d40'),
      orb('head', [0.28, 0.12, 0.26], [0, 0.14, 0], '#30445d'),
      box('head', [0.53, 0.06, 0.3], [0, 0.12, 0.23], '#5effdf'),
    ],
  },
  'confetti-shades': {
    slot: 'face',
    parts: [-0.13, 0.13].flatMap((x) => [
      box('face', [0.21, 0.14, 0.04], [x, 0.02, 0.08], '#9c50e5'),
      box('face', [0.14, 0.07, 0.05], [x, 0.02, 0.11], '#ffdc57'),
    ]),
  },
  'comet-cape': {
    slot: 'top',
    parts: [
      box('body', [0.13, 0.68, 0.07], [-0.27, 0.7, -0.29], '#5b4ec4'),
      box('body', [0.13, 0.68, 0.07], [0.27, 0.7, -0.29], '#5b4ec4'),
      orb('body', [0.1, 0.1, 0.04], [0, 0.94, 0.3], '#ffcc61'),
    ],
  },
  'disco-boots': {
    slot: 'shoes',
    boots: '#5c38ae',
    parts: [
      box('legs', [0.3, 0.06, 0.42], [0, -0.47, 0.05], '#1d2430'),
      orb('legs', [0.1, 0.1, 0.1], [0, -0.3, 0.16], '#f95f9b'),
    ],
  },
  'frog-bucket-hat': {
    slot: 'hat',
    parts: [
      disc('head', 0.36, 0.035, [0, 0.015, 0], '#9bd5ad'),
      orb('head', [0.28, 0.15, 0.27], [0, 0.11, 0], '#9bd5ad'),
      orb('head', [0.06, 0.065, 0.035], [-0.13, 0.24, 0.19], '#263b30'),
      orb('head', [0.06, 0.065, 0.035], [0.13, 0.24, 0.19], '#263b30'),
    ],
  },
  'mushroom-cap': {
    slot: 'hat',
    parts: [
      orb('head', [0.37, 0.21, 0.34], [0, 0.13, 0], '#bd344c'),
      orb('head', [0.07, 0.026, 0.05], [-0.17, 0.29, 0.06], '#fff0ce'),
      orb('head', [0.06, 0.03, 0.06], [0.13, 0.3, 0.05], '#fff0ce'),
      orb('head', [0.055, 0.04, 0.03], [0.04, 0.19, 0.31], '#fff0ce'),
    ],
  },
  'strawberry-beret': {
    slot: 'hat',
    parts: [
      orb('head', [0.34, 0.13, 0.3], [0.035, 0.09, 0], '#c63860'),
      disc('head', 0.023, 0.09, [0.04, 0.24, 0], '#477247'),
      orb('head', [0.1, 0.022, 0.05], [-0.02, 0.2, 0], '#477247'),
      orb('head', [0.06, 0.022, 0.09], [0.07, 0.2, 0.02], '#477247'),
    ],
  },
  'saturn-hat': {
    slot: 'hat',
    parts: [
      orb('head', [0.26, 0.23, 0.25], [0, 0.14, 0], '#c8b3e9'),
      disc('head', 0.4, 0.026, [0, 0.12, 0], '#ffd4b7', [0.22, 0, 0.16]),
    ],
  },
  'bear-paw-shoes': {
    slot: 'shoes',
    boots: '#73513c',
    parts: [
      orb('legs', [0.16, 0.09, 0.18], [0, -0.4, 0.16], '#73513c'),
      box('legs', [0.22, 0.035, 0.05], [0, -0.41, 0.32], '#fff0ce'),
    ],
  },
  'ducky-boots': {
    slot: 'shoes',
    boots: '#fff08a',
    parts: [
      orb('legs', [0.14, 0.09, 0.16], [0, -0.38, 0.15], '#fff08a'),
      orb('legs', [0.11, 0.035, 0.07], [0, -0.41, 0.3], '#ba511c'),
    ],
  },
  'comet-sneakers': {
    slot: 'shoes',
    boots: '#d9c8f5',
    parts: [
      box('legs', [0.32, 0.04, 0.45], [0, -0.48, 0.065], '#c0eaff'),
      orb('legs', [0.065, 0.065, 0.08], [0.1, -0.38, -0.2], '#fff0ce'),
    ],
  },
  'leaf-dungarees': {
    slot: 'legs',
    overalls: '#476647',
    parts: [
      orb('body', [0.065, 0.08, 0.025], [0, 0.87, 0.29], '#bbdf8d'),
      box('legs', [0.26, 0.045, 0.3], [0, -0.33, 0], '#bbdf8d'),
    ],
  },
  'watermelon-shorts': {
    slot: 'legs',
    overalls: '#c63860',
    shorts: true,
    parts: [
      box('legs', [0.26, 0.045, 0.3], [0, -0.16, 0], '#315e3b'),
      orb('legs', [0.018, 0.026, 0.012], [0, -0.06, 0.15], '#263b30'),
    ],
  },
  'toast-puffer': {
    slot: 'top',
    parts: [
      box('body', [0.18, 0.44, 0.08], [-0.17, 0.87, 0.25], '#d4a05a'),
      box('body', [0.18, 0.44, 0.08], [0.17, 0.87, 0.25], '#d4a05a'),
      box('body', [0.1, 0.075, 0.04], [0.17, 0.81, 0.31], '#fff08a'),
    ],
  },
  'cloud-jacket': {
    slot: 'top',
    parts: [
      orb('body', [0.1, 0.21, 0.055], [-0.19, 0.9, 0.24], '#f7f4ff'),
      orb('body', [0.1, 0.21, 0.055], [0.19, 0.9, 0.24], '#f7f4ff'),
      box('arms', [0.24, 0.06, 0.3], [0, -0.14, 0], '#b9e0f5'),
    ],
  },
  'moon-glasses': {
    slot: 'face',
    parts: [-0.12, 0.12].flatMap((x) => [
      disc('face', 0.09, 0.022, [x, 0.02, 0.045], '#fff0ce', [
        Math.PI / 2,
        0,
        0,
      ]),
      disc('face', 0.067, 0.023, [x, 0.02, 0.052], '#c0eaff', [
        Math.PI / 2,
        0,
        0,
      ]),
    ]),
  },
};
