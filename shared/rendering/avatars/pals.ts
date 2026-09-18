import * as T from 'three';
import { COLORS } from '../palette';
import type { WorkerOutfit } from '../worker';
import {
  blink,
  capsule,
  cone,
  eye,
  rounded,
  shade,
  smile,
  soft,
} from './soft-parts';

const INK = '#26302c';
const NOSE = '#3b2a26';
const BLUSH = '#f0a39a';
const CREAM = '#f4ead2';

type Species = {
  name: string;
  fur: string;
  muzzle: string;
  inner: string;
};

/** One animal per player colour, in the same order as the colours. */
const SPECIES: readonly Species[] = [
  { name: 'bear', fur: '#a8754e', muzzle: '#e8c9a0', inner: '#d9a88a' },
  { name: 'cat', fur: '#8f98a3', muzzle: '#f1ece4', inner: '#f2b4b8' },
  { name: 'fox', fur: '#e08548', muzzle: '#fbf1e2', inner: '#fbf1e2' },
  { name: 'bunny', fur: '#f2ebe0', muzzle: '#fffaf3', inner: '#f2b4b8' },
];

type PalsRig = {
  body: T.Group;
  head: T.Group;
  legL: T.Group;
  legR: T.Group;
  armL: T.Group;
  armR: T.Group;
  ears: T.Group[];
  eyes: T.Group[];
};

function ears(head: T.Group, kind: Species) {
  return [-1, 1].map((side) => {
    const ear = new T.Group();
    head.add(ear);
    if (kind.name === 'bear') {
      ear.position.set(side * 0.25, 0.6, -0.02);
      soft(ear, [0.1, 0.1, 0.06], [0, 0, 0], kind.fur);
      soft(ear, [0.06, 0.06, 0.02], [0, 0, 0.045], kind.inner);
    } else if (kind.name === 'bunny') {
      ear.position.set(side * 0.12, 0.62, -0.03);
      ear.rotation.z = -side * 0.12;
      soft(ear, [0.07, 0.24, 0.05], [0, 0.22, 0], kind.fur);
      soft(ear, [0.04, 0.18, 0.02], [0, 0.22, 0.035], kind.inner);
    } else {
      const fox = kind.name === 'fox';
      ear.position.set(side * (fox ? 0.22 : 0.21), fox ? 0.62 : 0.6, -0.02);
      ear.rotation.z = -side * (fox ? 0.25 : 0.3);
      cone(ear, fox ? 0.11 : 0.1, fox ? 0.27 : 0.2, [0, 0.08, 0], kind.fur);
      cone(
        ear,
        fox ? 0.065 : 0.06,
        fox ? 0.18 : 0.13,
        [0, 0.06, 0.04],
        kind.inner,
      );
    }
    return ear;
  });
}

function tail(body: T.Group, kind: Species) {
  if (kind.name === 'fox') {
    const brush = soft(body, [0.12, 0.12, 0.26], [0, 0.46, -0.4], kind.fur);
    brush.rotation.x = 0.5;
    soft(body, [0.07, 0.07, 0.08], [0, 0.56, -0.6], kind.muzzle);
  } else if (kind.name === 'cat') {
    const curl = capsule(body, 0.045, 0.34, [0, 0.55, -0.36], kind.fur);
    curl.rotation.x = -0.6;
  } else {
    soft(
      body,
      [0.08, 0.08, 0.08],
      [0, 0.44, -0.31],
      kind.name === 'bunny' ? '#ffffff' : kind.fur,
    );
  }
}

/**
 * Pals, chubby party animals in hoodies: a bear, cat, fox or bunny by player
 * colour. They wear the worker's outfit (`shirt` is the hoodie, `overalls`
 * the shorts, `boots` the sneakers); the ears are their hat, so `cap` is
 * ignored. They keep the worker's rig.
 */
export function pals(color = 0, outfit: WorkerOutfit = {}) {
  const kind = SPECIES[color % SPECIES.length];
  const hoodie = outfit.shirt ?? COLORS[color % COLORS.length];
  const shorts = outfit.overalls ?? '#385d63';
  const sneakers = outfit.boots ?? '#f1e9d8';
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);

  soft(body, [0.33, 0.16, 0.3], [0, 0.38, 0], shorts);
  soft(body, [0.36, 0.34, 0.31], [0, 0.66, 0], hoodie);
  rounded(body, [0.3, 0.12, 0.04], [0, 0.56, 0.27], shade(hoodie, -0.06), 0.02);
  soft(body, [0.26, 0.1, 0.14], [0, 0.96, -0.14], hoodie);
  for (const side of [-1, 1])
    soft(body, [0.012, 0.06, 0.012], [side * 0.05, 0.86, 0.29], CREAM);
  tail(body, kind);

  const head = new T.Group();
  head.position.set(0, 0.96, 0);
  body.add(head);
  soft(head, [0.38, 0.34, 0.35], [0, 0.32, 0], kind.fur);
  soft(head, [0.16, 0.11, 0.1], [0, 0.22, 0.27], kind.muzzle);
  soft(head, [0.05, 0.035, 0.03], [0, 0.27, 0.365], NOSE);
  const eyes = [-1, 1].map((side) =>
    eye(head, [0.045, 0.058, 0.025], [side * 0.14, 0.37, 0.31], INK),
  );
  for (const side of [-1, 1])
    soft(head, [0.05, 0.03, 0.012], [side * 0.22, 0.26, 0.28], BLUSH);
  smile(
    head,
    [
      [-0.05, 0.19, 0.352],
      [-0.02, 0.172, 0.365],
      [0.02, 0.172, 0.365],
      [0.05, 0.19, 0.352],
    ],
    NOSE,
  );
  const earPair = ears(head, kind);

  const legs = [-1, 1].map((side) => {
    const leg = new T.Group();
    leg.position.set(side * 0.15, 0.3, 0);
    soft(leg, [0.12, 0.15, 0.12], [0, -0.1, 0], kind.fur);
    soft(leg, [0.14, 0.1, 0.14], [0, 0, 0], shorts);
    soft(leg, [0.13, 0.08, 0.18], [0, -0.22, 0.04], sneakers);
    body.add(leg);
    return leg;
  });
  const arms = [-1, 1].map((side) => {
    const arm = new T.Group();
    arm.position.set(side * 0.34, 0.9, 0);
    const splay = new T.Group();
    splay.rotation.z = side * 0.3;
    soft(splay, [0.1, 0.17, 0.1], [0, -0.12, 0], hoodie);
    soft(splay, [0.09, 0.09, 0.09], [0, -0.3, 0.02], kind.fur);
    arm.add(splay);
    body.add(arm);
    return arm;
  });

  Object.assign(g.userData, {
    body,
    head,
    eyes,
    ears: earPair,
    legs,
    arms,
    legL: legs[0],
    legR: legs[1],
    armL: arms[0],
    armR: arms[1],
    species: kind.name,
  });
  return g;
}

/**
 * Bounces a Pals along with its ears bobbing; standing, it looks about and
 * blinks. `time` is in seconds.
 */
export function walkPals(model: T.Object3D, time: number, walking: boolean) {
  const rig = model.userData as PalsRig;
  const beat = time * 8.5;
  const swing = walking ? Math.sin(beat) : 0;
  const bounce = Math.abs(swing);
  rig.legL.rotation.x = swing * 0.55;
  rig.legR.rotation.x = -swing * 0.55;
  rig.armL.rotation.x = -swing * 0.65;
  rig.armR.rotation.x = swing * 0.65;
  rig.body.position.y = walking ? bounce * 0.06 : 0;
  rig.head.rotation.y = walking ? 0 : Math.sin(time * 0.7) * 0.2;
  rig.head.rotation.z = walking ? Math.sin(beat / 2) * 0.06 : 0;
  for (const ear of rig.ears) ear.rotation.x = walking ? -bounce * 0.2 : 0;
  for (const e of rig.eyes) e.scale.y = blink(time, 2.3);
}
