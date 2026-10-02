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
