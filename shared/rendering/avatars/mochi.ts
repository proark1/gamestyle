import * as T from 'three';
import { COLORS } from '../palette';
import { ball } from '../primitives';

const SKIN = '#ffe3c8';
const CREAM = '#fff3e0';
const PINK = '#f4a6ad';
const EYE = '#2a2230';
/** How far the stubby arms stand out from the round body. */
const SPLAY = 0.55;
/** Resting ear tilts, left then right: one ear flops further than the other. */
const EAR_REST = [0.16, -0.3];
let shine: T.MeshBasicMaterial | undefined;

type MochiRig = {
  body: T.Group;
  head: T.Group;
  legL: T.Group;
  legR: T.Group;
  armL: T.Group;
  armR: T.Group;
  splays: T.Group[];
  ears: T.Group[];
  eyes: T.Group[];
};

/**
 * Mochi, the cute potential avatar: a round little one in a bunny-eared hood,
 * with big shining eyes and rosy cheeks. It keeps the shared worker's rig
 * (`userData.body`, `legL`, `legR`, `armL`, `armR`, feet at the origin, facing
 * +Z), so a game's worker animation can drive it.
 */
export function mochi(color = 0) {
  const hood = COLORS[color % COLORS.length];
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);

  // A round onesie with a tummy patch and a pom-pom tail.
  ball(body, [0.28, 0.29, 0.26], [0, 0.5, 0], hood);
  ball(body, [0.17, 0.19, 0.07], [0, 0.47, 0.215], CREAM);
  ball(body, [0.085, 0.085, 0.085], [0, 0.4, -0.25], '#fffaf2');

  const head = new T.Group();
  head.position.set(0, 0.74, 0);
  body.add(head);
  ball(head, [0.37, 0.34, 0.35], [0, 0.32, -0.02], hood);
  ball(head, [0.29, 0.26, 0.14], [0, 0.3, 0.2], SKIN);
  // Big eyes, each with a highlight that stays bright in any light.
  const glint = (shine ??= new T.MeshBasicMaterial({
    color: '#ffffff',
    toneMapped: false,
  }));
  const eyes = [-1, 1].map((side) => {
    const eye = new T.Group();
    eye.position.set(side * 0.105, 0.32, 0.325);
    ball(eye, [0.05, 0.065, 0.03], [0, 0, 0], EYE);
    const highlight: T.Mesh = ball(
      eye,
      [0.018, 0.02, 0.01],
      [0.016, 0.024, 0.026],
      EYE,
    );
    highlight.material = glint;
    head.add(eye);
    return eye;
  });
  for (const side of [-1, 1])
    ball(head, [0.045, 0.026, 0.012], [side * 0.175, 0.255, 0.305], PINK);
  for (const [x, y] of [
    [-0.024, 0.248],
    [0, 0.238],
    [0.024, 0.248],
  ])
    ball(head, [0.014, 0.01, 0.008], [x, y, 0.336], '#8a4b4b');
  const ears = [-1, 1].map((side, i) => {
    const ear = new T.Group();
    ear.position.set(side * 0.13, 0.6, -0.04);
    ear.rotation.z = EAR_REST[i];
    ball(ear, [0.075, 0.23, 0.05], [0, 0.2, 0], hood);
    ball(ear, [0.045, 0.17, 0.02], [0, 0.2, 0.035], PINK);
    head.add(ear);
    return ear;
  });

  const legs = [-1, 1].map((side) => {
    const leg = new T.Group();
    leg.position.set(side * 0.12, 0.3, 0);
    ball(leg, [0.1, 0.13, 0.1], [0, -0.1, 0], hood);
    ball(leg, [0.11, 0.075, 0.14], [0, -0.225, 0.035], CREAM);
    body.add(leg);
    return leg;
  });
  const splays: T.Group[] = [];
  const arms = [-1, 1].map((side) => {
    const arm = new T.Group();
    arm.position.set(side * 0.24, 0.66, 0);
    const splay = new T.Group();
    splay.rotation.z = side * SPLAY;
    ball(splay, [0.07, 0.13, 0.07], [0, -0.09, 0], hood);
    ball(splay, [0.065, 0.065, 0.065], [0, -0.21, 0.01], CREAM);
    arm.add(splay);
    body.add(arm);
    splays.push(splay);
    return arm;
  });

  Object.assign(g.userData, {
    body,
    head,
    eyes,
    ears,
    legs,
    arms,
    splays,
    legL: legs[0],
    legR: legs[1],
    armL: arms[0],
    armR: arms[1],
  });
  return g;
}

/**
 * Hops a Mochi along with its ears flopping behind; standing, it breathes,
 * blinks and twitches an ear. `time` is in seconds.
 */
export function walkMochi(model: T.Object3D, time: number, walking: boolean) {
  const rig = model.userData as MochiRig;
  const beat = time * 7.5;
  const swing = walking ? Math.sin(beat) : 0;
  const hop = Math.abs(swing);
  rig.legL.rotation.x = swing * 0.5;
  rig.legR.rotation.x = -swing * 0.5;
  rig.armL.rotation.x = -swing * 0.7;
  rig.armR.rotation.x = swing * 0.7;
  rig.splays[0].rotation.z = -(SPLAY + hop * 0.2);
  rig.splays[1].rotation.z = SPLAY + hop * 0.2;
  // Little hops that squash on landing and stretch in the air.
  rig.body.position.y = hop * 0.13;
  const stretch = walking
    ? -Math.cos(2 * beat) * 0.04
    : Math.sin(time * 2.2) * 0.012;
  rig.body.scale.set(1 - stretch / 2, 1 + stretch, 1 - stretch / 2);
  rig.head.rotation.z = walking
    ? Math.sin(beat / 2) * 0.1
    : Math.sin(time * 0.9) * 0.05;
  const twitch = Math.max(0, 1 - Math.abs((time % 3.4) - 0.2) / 0.12);
  rig.ears.forEach((ear, i) => {
    ear.rotation.x = walking
      ? -0.15 - Math.abs(Math.sin(beat - 0.7)) * 0.35
      : -0.08;
    ear.rotation.z =
      EAR_REST[i] +
      (walking ? Math.sin(beat + i) * 0.1 : i ? -twitch * 0.25 : 0);
  });
  const open = (time + 1.5) % 3.9 < 0.12 ? 0.12 : 1;
  for (const eye of rig.eyes) eye.scale.y = open;
}
