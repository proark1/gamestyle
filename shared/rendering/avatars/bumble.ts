import * as T from 'three';
import { COLORS } from '../palette';
import { ball, beam, box, taper } from '../primitives';

const SKIN = '#f2cfa0';
const RED = '#cf4f3f';
const CREAM = '#fbf3df';
const YELLOW = '#f2c14e';
const SKY = '#5aa0d8';
const INK = '#385d63';
const HAIR = '#5b3a29';
/** How far the arms stand out from the belly. */
const SPLAY = 0.42;

type BumbleRig = {
  body: T.Group;
  head: T.Group;
  propeller: T.Group;
  legL: T.Group;
  legR: T.Group;
  armL: T.Group;
  armR: T.Group;
  splays: T.Group[];
  pupils: T.Mesh[];
  pupilRest: T.Vector3[];
};

/**
 * Bumble, the funny potential avatar: a pear-shaped goof on skinny legs in
 * giant shoes, with googly eyes, a red nose and a propeller cap. It keeps the
 * shared worker's rig (`userData.body`, `legL`, `legR`, `armL`, `armR`, feet
 * at the origin, facing +Z), so a game's worker animation can drive it.
 */
export function bumble(color = 0) {
  const shirt = COLORS[color % COLORS.length];
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);

  // A pear of a belly with braces and buttons, and a bow tie on a short neck.
  ball(body, [0.34, 0.4, 0.3], [0, 0.88, 0], shirt);
  for (const x of [-0.12, 0.12]) {
    beam(body, [x, 0.7, 0.25], [x, 1.22, 0.13], 0.045, INK);
    ball(body, [0.03, 0.03, 0.015], [x, 0.72, 0.262], YELLOW);
  }
  taper(body, 0.075, 0.085, 0.14, [0, 1.3, 0], SKIN);
  for (const side of [-1, 1])
    box(
      body,
      [0.1, 0.075, 0.04],
      [side * 0.055, 1.28, 0.11],
      YELLOW,
    ).rotation.z = side * 0.35;
  ball(body, [0.03, 0.03, 0.025], [0, 1.28, 0.13], RED);

  const head = new T.Group();
  head.position.set(0, 1.32, 0.02);
  body.add(head);
  ball(head, [0.19, 0.21, 0.19], [0, 0.2, 0], SKIN);
  for (const side of [-1, 1])
    ball(head, [0.035, 0.06, 0.04], [side * 0.19, 0.2, 0], SKIN);
  // Googly eyes, each looking its own way.
  const eyes: T.Group[] = [];
  const pupils: T.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = new T.Group();
    eye.position.set(side * 0.075, 0.25, 0.165);
    ball(eye, [0.095, 0.1, 0.06], [0, 0, 0], '#ffffff');
    pupils.push(
      ball(
        eye,
        [0.038, 0.04, 0.02],
        side < 0 ? [0.03, -0.02, 0.05] : [-0.005, 0.03, 0.05],
        '#1d2a2a',
      ),
    );
    head.add(eye);
    eyes.push(eye);
  }
  ball(head, [0.07, 0.065, 0.065], [0, 0.15, 0.2], RED);
  for (const side of [-1, 1])
    ball(
      head,
      [0.075, 0.028, 0.035],
      [side * 0.058, 0.09, 0.17],
      HAIR,
    ).rotation.z = side * 0.35;
  box(head, [0.03, 0.035, 0.012], [0, 0.045, 0.135], '#ffffff');
  // A propeller cap.
  ball(head, [0.2, 0.11, 0.2], [0, 0.37, 0], SKY);
  ball(head, [0.12, 0.02, 0.1], [0, 0.36, 0.14], YELLOW);
  box(head, [0.025, 0.09, 0.025], [0, 0.5, 0], INK);
  const propeller = new T.Group();
  propeller.position.set(0, 0.56, 0);
  box(propeller, [0.4, 0.014, 0.07], [0, 0, 0], RED);
  ball(propeller, [0.03, 0.02, 0.03], [0, 0.012, 0], shirt);
  head.add(propeller);

  // Skinny striped socks in enormous shoes.
  const legs = [-1, 1].map((side) => {
    const leg = new T.Group();
    leg.position.set(side * 0.14, 0.55, 0);
    box(leg, [0.07, 0.36, 0.07], [0, -0.23, 0], CREAM);
    for (const y of [-0.15, -0.27])
      box(leg, [0.076, 0.035, 0.076], [0, y, 0], RED);
    ball(leg, [0.15, 0.1, 0.27], [side * 0.02, -0.45, 0.11], RED);
    body.add(leg);
    return leg;
  });
  // Noodle arms in puffed sleeves, ending in big gloves.
  const splays: T.Group[] = [];
  const arms = [-1, 1].map((side) => {
    const arm = new T.Group();
    arm.position.set(side * 0.27, 1.16, 0);
    const splay = new T.Group();
    splay.rotation.z = side * SPLAY;
    ball(splay, [0.085, 0.1, 0.085], [0, -0.04, 0], shirt);
    box(splay, [0.05, 0.4, 0.05], [0, -0.26, 0], SKIN);
    ball(splay, [0.075, 0.03, 0.075], [0, -0.45, 0], CREAM);
    ball(splay, [0.09, 0.095, 0.085], [0, -0.53, 0.01], CREAM);
    arm.add(splay);
    body.add(arm);
    splays.push(splay);
    return arm;
  });

  Object.assign(g.userData, {
    body,
    head,
    propeller,
    eyes,
    pupils,
    pupilRest: pupils.map((pupil) => pupil.position.clone()),
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

/** Waddles a Bumble along, arms flailing and propeller whirring; `time` is in seconds. */
export function walkBumble(model: T.Object3D, time: number, walking: boolean) {
  const rig = model.userData as BumbleRig;
  const stride = time * 9;
  const swing = walking ? Math.sin(stride) : 0;
  rig.legL.rotation.x = swing * 0.75;
  rig.legR.rotation.x = -swing * 0.75;
  rig.armL.rotation.x = -swing * 0.9;
  rig.armR.rotation.x = swing * 0.9;
  // The arms flap out on every step while the body waddles and bounces.
  const flap = Math.abs(swing) * 0.35;
  rig.splays[0].rotation.z = -(SPLAY + flap);
  rig.splays[1].rotation.z = SPLAY + flap;
  rig.body.rotation.z = swing * 0.13;
  rig.body.position.y = walking ? Math.abs(Math.cos(stride)) * 0.05 : 0;
  rig.head.rotation.z = walking
    ? Math.sin(stride - 0.8) * 0.18
    : Math.sin(time * 1.3) * 0.04;
  rig.head.rotation.x = Math.abs(swing) * 0.12;
  rig.propeller.rotation.y = time * (walking ? 22 : 5);
  // The googly pupils rattle around inside their eyes.
  const rattle = walking ? 0.018 : 0.008;
  const speed = walking ? 21 : 1.6;
  rig.pupils.forEach((pupil, i) => {
    const rest = rig.pupilRest[i];
    pupil.position.x = rest.x + Math.sin(time * speed + i * 2) * rattle;
    pupil.position.y = rest.y + Math.cos(time * speed * 0.9 + i) * rattle;
  });
}
