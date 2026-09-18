import * as T from 'three';
import { COLORS } from '../palette';
import type { WorkerOutfit } from '../worker';
import { blink, eye, rounded, shade, smile, soft } from './soft-parts';

const SKIN = '#f1c7a0';
const SKIN_SHADE = '#e3ad86';
const INK = '#26302c';
const HAIR = '#6b4531';
const BLUSH = '#f0a39a';
const BADGE = '#f4ead2';
const BRASS = '#ebc35f';

type PipRig = {
  body: T.Group;
  head: T.Group;
  legL: T.Group;
  legR: T.Group;
  armL: T.Group;
  armR: T.Group;
  eyes: T.Group[];
};

/**
 * Pip, a chibi co-op crewmate: a big round head on a small body in the
 * worker's overalls, with floating mitten hands. It wears the worker's outfit
 * (`cap` false shows its hair instead of the cap) and keeps the worker's rig.
 */
export function pip(color = 0, outfit: WorkerOutfit = {}) {
  const shirt = outfit.shirt ?? COLORS[color % COLORS.length];
  const overalls = outfit.overalls ?? '#385d63';
  const shoes = outfit.boots ?? '#4c4840';
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);

  rounded(body, [0.52, 0.18, 0.38], [0, 0.38, 0], overalls, 0.08);
  rounded(body, [0.5, 0.4, 0.36], [0, 0.63, 0], shirt, 0.14);
  rounded(body, [0.3, 0.22, 0.04], [0, 0.58, 0.175], overalls, 0.015);
  for (const side of [-1, 1]) {
    rounded(
      body,
      [0.06, 0.2, 0.03],
      [side * 0.13, 0.74, 0.168],
      overalls,
      0.01,
    );
    soft(body, [0.022, 0.022, 0.012], [side * 0.13, 0.68, 0.19], BRASS);
  }

  const head = new T.Group();
  head.position.set(0, 0.8, 0);
  body.add(head);
  rounded(head, [0.8, 0.7, 0.68], [0, 0.36, 0], SKIN, 0.28);
  for (const side of [-1, 1])
    soft(head, [0.06, 0.09, 0.05], [side * 0.41, 0.34, 0], SKIN_SHADE);
  const eyes = [-1, 1].map((side) =>
    eye(head, [0.05, 0.07, 0.025], [side * 0.15, 0.4, 0.33], INK),
  );
  soft(head, [0.05, 0.04, 0.035], [0, 0.31, 0.345], SKIN_SHADE);
  for (const side of [-1, 1])
    soft(head, [0.06, 0.035, 0.015], [side * 0.25, 0.28, 0.31], BLUSH);
  smile(
    head,
    [
      [-0.07, 0.235, 0.328],
      [-0.03, 0.212, 0.338],
      [0.03, 0.212, 0.338],
      [0.07, 0.235, 0.328],
    ],
    '#7a3f3a',
  );

  if (outfit.cap === false) {
    rounded(head, [0.84, 0.24, 0.72], [0, 0.63, -0.02], HAIR, 0.1);
    const fringe = rounded(
      head,
      [0.5, 0.12, 0.14],
      [0.08, 0.56, 0.3],
      HAIR,
      0.05,
    );
    fringe.rotation.z = -0.2;
  } else {
    soft(head, [0.44, 0.26, 0.4], [0, 0.62, -0.01], shirt);
    rounded(
      head,
      [0.52, 0.05, 0.3],
      [0, 0.58, 0.32],
      shade(shirt, -0.08),
      0.02,
    );
    soft(head, [0.07, 0.05, 0.015], [0, 0.72, 0.36], BADGE);
    for (const side of [-1, 1])
      soft(head, [0.06, 0.08, 0.1], [side * 0.4, 0.5, -0.08], HAIR);
  }

  const legs = [-1, 1].map((side) => {
    const leg = new T.Group();
    leg.position.set(side * 0.13, 0.3, 0);
    rounded(leg, [0.17, 0.2, 0.19], [0, -0.09, 0], overalls, 0.07);
    rounded(leg, [0.21, 0.12, 0.27], [0, -0.24, 0.04], shoes, 0.05);
    body.add(leg);
    return leg;
  });
  // No arms: each hand floats beside the body and swings from the shoulder.
  const arms = [-1, 1].map((side) => {
    const arm = new T.Group();
    arm.position.set(side * 0.36, 0.72, 0);
    soft(arm, [0.1, 0.1, 0.1], [side * 0.03, -0.2, 0.05], SKIN);
    body.add(arm);
    return arm;
  });

  Object.assign(g.userData, {
    body,
    head,
    eyes,
    legs,
    arms,
    legL: legs[0],
    legR: legs[1],
    armL: arms[0],
    armR: arms[1],
  });
  return g;
}

/**
 * Walks a Pip in quick little steps with its hands pumping and its big head
 * nodding; standing, it sways and blinks. `time` is in seconds.
 */
export function walkPip(model: T.Object3D, time: number, walking: boolean) {
  const rig = model.userData as PipRig;
  const beat = time * 10;
  const swing = walking ? Math.sin(beat) : 0;
  rig.legL.rotation.x = swing * 0.6;
  rig.legR.rotation.x = -swing * 0.6;
  rig.armL.rotation.x = -swing * 0.9;
  rig.armR.rotation.x = swing * 0.9;
  rig.body.position.y = walking ? Math.abs(swing) * 0.04 : 0;
  rig.head.rotation.x = walking ? Math.abs(swing) * 0.06 : 0;
  rig.head.rotation.z = walking
    ? Math.sin(beat / 2) * 0.05
    : Math.sin(time * 1.1) * 0.04;
  for (const e of rig.eyes) e.scale.y = blink(time, 0.7);
}
