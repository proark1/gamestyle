import type { Anchor, ItemModel, Part } from './items';

type Vec = [number, number, number];
const ball = (on: Anchor, at: Vec, size: Vec, colour: string): Part => ({
  shape: 'ball',
  on,
  at,
  size,
  colour,
});
const box = (
  on: Anchor,
  at: Vec,
  size: Vec,
  colour: string,
  turn?: Vec,
): Part => ({
  shape: 'box',
  on,
  at,
  size,
  colour,
  rounded: true,
  turn,
});
const spike = (
  on: Anchor,
  at: Vec,
  height: number,
  colour: string,
  turn?: Vec,
): Part => ({
  shape: 'taper',
  on,
  at,
  top: 0,
  bottom: 0.075,
  height,
  sides: 8,
  colour,
  turn,
});

/** Common cuffs and hems make the base shirt, trousers and boots read as one suit. */
function suit(base: string, trim: string, boots: string): Part[] {
  return [
    box('body', [0, 1.16, 0], [0.69, 0.1, 0.46], trim),
    box('body', [0, 0.57, 0], [0.69, 0.1, 0.46], trim),
    box('arms', [0, -0.11, 0], [0.25, 0.34, 0.3], base),
    box('arms', [0, -0.34, 0], [0.26, 0.09, 0.31], trim),
    box('legs', [0, -0.08, 0], [0.27, 0.12, 0.29], trim),
    box('legs', [0, -0.39, 0], [0.28, 0.12, 0.34], trim),
    ball('legs', [0, -0.44, 0.19], [0.17, 0.07, 0.17], boots),
  ];
}

/** Five original costumes, built from the same moving anchors as the wardrobe. */
export const COSTUME_MODELS: Record<string, ItemModel> = {
  mossweaver: {
    slot: 'costume',
    shirt: '#6e9e79',
    overalls: '#446d62',
    boots: '#d9a959',
    parts: [
      ...suit('#6e9e79', '#d9a959', '#d9a959'),
      ball('body', [0, 0.86, -0.28], [0.31, 0.29, 0.22], '#446d62'),
      ball('body', [0, 0.9, -0.49], [0.22, 0.24, 0.15], '#d9a959'),
      ...[-1, 1].flatMap((side): Part[] => [
        box('body', [side * 0.57, 0.98, 0.11], [0.29, 0.065, 0.08], '#446d62', [
          0,
          0,
          side * 0.48,
        ]),
        box('body', [side * 0.58, 0.77, 0.11], [0.27, 0.065, 0.08], '#446d62', [
          0,
          0,
          -side * 0.45,
        ]),
      ]),
      ball('head', [-0.28, 0.02, -0.09], [0.09, 0.08, 0.09], '#d9a959'),
      ball('head', [0.28, 0.02, -0.09], [0.09, 0.08, 0.09], '#d9a959'),
      box('head', [0, 0.04, -0.24], [0.43, 0.2, 0.08], '#446d62'),
    ],
  },
  'thunder-hen': {
    slot: 'costume',
    shirt: '#f5e7c9',
    overalls: '#d9c5ee',
    boots: '#dc8655',
    parts: [
      ...suit('#f5e7c9', '#d9c5ee', '#dc8655'),
      ball('body', [0, 0.85, 0.2], [0.27, 0.25, 0.15], '#fff2d9'),
      ball('arms', [0, -0.12, -0.12], [0.18, 0.25, 0.1], '#d9c5ee'),
      ...[-1, 0, 1].map((i) =>
        ball('body', [i * 0.13, 1.04, -0.31], [0.09, 0.18, 0.11], '#fff2d9'),
      ),
      ...[-1, 0, 1].map((i) =>
        ball(
          'head',
          [i * 0.115, 0.2 + (i === 0 ? 0.06 : 0), 0],
          [0.085, 0.15, 0.085],
          '#58b9b0',
        ),
      ),
      ball('head', [-0.28, -0.04, -0.08], [0.11, 0.13, 0.09], '#f5e7c9'),
      ball('head', [0.28, -0.04, -0.08], [0.11, 0.13, 0.09], '#f5e7c9'),
      box('head', [0, 0.04, -0.24], [0.43, 0.2, 0.08], '#d9c5ee'),
    ],
  },
  'kite-knight': {
    slot: 'costume',
    shirt: '#eaa873',
    overalls: '#408c8c',
    boots: '#5d6f80',
    parts: [
      ...suit('#eaa873', '#408c8c', '#5d6f80'),
      box('body', [0, 0.94, 0.25], [0.16, 0.36, 0.06], '#f9dc9d'),
      box('body', [0, 0.78, 0.26], [0.35, 0.065, 0.06], '#f9dc9d'),
      box('body', [0, 0.94, -0.29], [0.42, 0.5, 0.07], '#408c8c', [0.08, 0, 0]),
      ball('arms', [0, -0.02, 0], [0.18, 0.13, 0.19], '#f9dc9d'),
      box('head', [0, 0.07, -0.23], [0.47, 0.23, 0.08], '#408c8c'),
      ball('head', [-0.3, 0.02, -0.05], [0.08, 0.13, 0.1], '#408c8c'),
      ball('head', [0.3, 0.02, -0.05], [0.08, 0.13, 0.1], '#408c8c'),
      spike('head', [0, 0.22, -0.13], 0.2, '#f9dc9d'),
    ],
  },
  'comet-diver': {
    slot: 'costume',
    shirt: '#e99057',
    overalls: '#70b9b4',
    boots: '#4c7288',
    parts: [
      ...suit('#e99057', '#70b9b4', '#4c7288'),
      box('body', [0, 0.92, -0.32], [0.42, 0.43, 0.19], '#4c7288'),
      ball('body', [-0.15, 1.05, 0.24], [0.08, 0.08, 0.04], '#f8dda1'),
      ball('body', [0.15, 1.05, 0.24], [0.08, 0.08, 0.04], '#f8dda1'),
      box('body', [0, 0.76, 0.24], [0.3, 0.09, 0.06], '#f8dda1'),
      ball('arms', [0, -0.06, 0], [0.16, 0.12, 0.16], '#f8dda1'),
      box('head', [0, 0.05, -0.24], [0.47, 0.2, 0.08], '#70b9b4'),
      ball('head', [-0.29, 0, -0.02], [0.075, 0.16, 0.09], '#f8dda1'),
      ball('head', [0.29, 0, -0.02], [0.075, 0.16, 0.09], '#f8dda1'),
    ],
  },
  'puddle-dragon': {
    slot: 'costume',
    shirt: '#6a9d72',
    overalls: '#4d7d73',
    boots: '#df8e72',
    parts: [
      ...suit('#6a9d72', '#df8e72', '#df8e72'),
      ball('body', [0, 0.89, 0.24], [0.24, 0.28, 0.09], '#bad09b'),
      ball('body', [-0.27, 1.02, -0.33], [0.15, 0.25, 0.08], '#df8e72'),
      ball('body', [0.27, 1.02, -0.33], [0.15, 0.25, 0.08], '#df8e72'),
      box(
        'body',
        [0, 0.63, -0.42],
        [0.13, 0.43, 0.12],
        '#4d7d73',
        [0.42, 0, 0],
      ),
      ...[0.69, 0.88, 1.06].map((y) =>
        spike('body', [0, y, -0.28], 0.16, '#df8e72', [Math.PI / 2, 0, 0]),
      ),
      box('head', [0, 0.05, -0.24], [0.46, 0.22, 0.08], '#4d7d73'),
      spike('head', [-0.24, 0.2, -0.1], 0.18, '#df8e72', [0, 0, 0.3]),
      spike('head', [0.24, 0.2, -0.1], 0.18, '#df8e72', [0, 0, -0.3]),
    ],
  },
};
