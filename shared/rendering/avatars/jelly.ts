import * as T from 'three';
import { COLORS } from '../palette';
import type { WorkerOutfit } from '../worker';
import {
  blink,
  capsule,
  eye,
  lathe,
  rounded,
  shade,
  smile,
  soft,
} from './soft-parts';

const SKIN = '#f3cda8';
const INK = '#26302c';
const BLUSH = '#f0a39a';
const BADGE = '#f4ead2';
/** The bean's radius and the straight part between its round ends. */
const RADIUS = 0.42;
const MIDDLE = 0.62;
/** Where the bean's bottom sits, above the stubby legs. */
const BASE = 0.22;
/** How far the stubby arms stand out from the bean. */
const SPLAY = 0.35;

type JellyRig = {
  body: T.Group;
  legL: T.Group;
  legR: T.Group;
  armL: T.Group;
  armR: T.Group;
  eyes: T.Group[];
};

/** The lower round end and a band above it, a little wider than the bean. */
function shortsProfile(): [number, number][] {
  const r = RADIUS + 0.008;
  const points: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * (Math.PI / 2);
    points.push([Math.max(0.0001, r * Math.cos(a)), r * Math.sin(a)]);
  }
  points.push([r, 0.14]);
  return points;
}

/**
 * Jelly, a party-game bean: one soft capsule for head and body, a face window
 * with big eyes, stubby arms and legs. It wears the worker's outfit (`shirt`
 * is the bean, `overalls` the shorts, `boots` the shoes, `cap` a cap), keeps
 * the worker's rig, and its round top sits at the worker's head top.
 */
export function jelly(color = 0, outfit: WorkerOutfit = {}) {
  const suit = outfit.shirt ?? COLORS[color % COLORS.length];
  const shorts = outfit.overalls ?? '#385d63';
  const shoes = outfit.boots ?? '#4c4840';
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);

  const low = BASE + RADIUS;
  capsule(body, RADIUS, MIDDLE, [0, low + MIDDLE / 2, 0], suit);
  lathe(body, 'jelly-shorts', shortsProfile, [0, low, 0], shorts);
  // A round player badge on the chest.
  soft(body, [0.075, 0.075, 0.016], [0.16, 0.95, 0.392], BADGE);
  soft(body, [0.035, 0.035, 0.01], [0.16, 0.95, 0.406], shade(suit, -0.08));

  // The face window, set into the front of the bean.
  const top = low + MIDDLE;
  soft(body, [0.3, 0.25, 0.12], [0, top - 0.04, 0.33], SKIN);
  const eyes = [-1, 1].map((side) =>
    eye(
      body,
      [0.046, 0.06, 0.02],
      [side * 0.1, top, 0.457],
      INK,
      [0.075, 0.09, 0.03],
    ),
  );
  for (const side of [-1, 1])
    soft(body, [0.045, 0.025, 0.012], [side * 0.19, top - 0.1, 0.412], BLUSH);
  smile(
    body,
    [
      [-0.07, top - 0.11, 0.436],
      [-0.03, top - 0.135, 0.448],
      [0.03, top - 0.135, 0.448],
      [0.07, top - 0.11, 0.436],
    ],
    '#7a3f3a',
  );

  if (outfit.cap !== false) {
    const cap = shade(suit, -0.12);
    soft(body, [0.37, 0.2, 0.37], [0, top + 0.34, 0], cap);
    const brim = rounded(
      body,
      [0.4, 0.04, 0.28],
      [0, top + 0.34, 0.33],
      cap,
      0.02,
    );
    brim.rotation.x = -0.12;
    soft(body, [0.08, 0.05, 0.02], [0, top + 0.42, 0.335], BADGE);
  }

  const legs = [-1, 1].map((side) => {
    const leg = new T.Group();
    leg.position.set(side * 0.17, 0.3, 0);
    capsule(leg, 0.1, 0.1, [0, -0.08, 0], shorts);
    soft(leg, [0.13, 0.08, 0.17], [0, -0.22, 0.04], shoes);
    body.add(leg);
    return leg;
  });
  const arms = [-1, 1].map((side) => {
    const arm = new T.Group();
    arm.position.set(side * (RADIUS - 0.01), 0.98, 0);
    const splay = new T.Group();
    splay.rotation.z = side * SPLAY;
    capsule(splay, 0.085, 0.2, [0, -0.13, 0], suit);
    soft(splay, [0.1, 0.1, 0.1], [0, -0.3, 0.02], SKIN);
    arm.add(splay);
    body.add(arm);
    return arm;
  });

  Object.assign(g.userData, {
    body,
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
 * Waddles a Jelly, rocking side to side with little bounces; standing, it
 * breathes and blinks. `time` is in seconds.
 */
export function walkJelly(model: T.Object3D, time: number, walking: boolean) {
  const rig = model.userData as JellyRig;
  const beat = time * 8;
  const swing = walking ? Math.sin(beat) : 0;
  rig.legL.rotation.x = swing * 0.55;
  rig.legR.rotation.x = -swing * 0.55;
  rig.armL.rotation.x = -swing * 0.7;
  rig.armR.rotation.x = swing * 0.7;
  rig.body.rotation.z = swing * 0.07;
  rig.body.position.y = walking ? Math.abs(swing) * 0.05 : 0;
  const breath = walking ? 0 : Math.sin(time * 2.2) * 0.012;
  rig.body.scale.set(1 - breath / 2, 1 + breath, 1 - breath / 2);
  for (const e of rig.eyes) e.scale.y = blink(time);
}
