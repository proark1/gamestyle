import * as T from 'three';
import { COLORS } from '../palette';
import { ball, box, taper } from '../primitives';

const CLOAK = '#2d2a3a';
const SHADOW = '#23212b';
const VOID = '#0b0a0f';
const BONE = '#dcd4c0';
/** How far the upper body leans forward over its chest. */
const HUNCH = 0.38;
const glows = new Map<string, T.MeshBasicMaterial>();

type HollowRig = {
  body: T.Group;
  upper: T.Group;
  head: T.Group;
  hem: T.Group;
  legL: T.Group;
  legR: T.Group;
  armL: T.Group;
  armR: T.Group;
  eyes: T.Group[];
};

/** Unlit, so the eyes glow even in the dark. */
function glow(color: string) {
  let lit = glows.get(color);
  if (!lit) {
    lit = new T.MeshBasicMaterial({ color, toneMapped: false });
    glows.set(color, lit);
  }
  return lit;
}

/**
 * Hollow, the scary potential avatar: a tall, hunched, hooded wraith with a
 * stitched bone mask, glowing eyes and long clawed arms. It keeps the shared
 * worker's rig (`userData.body`, `legL`, `legR`, `armL`, `armR`, feet at the
 * origin, facing +Z), so a game's worker animation can drive it.
 */
export function hollow(color = 0) {
  const eyeColor = COLORS[color % COLORS.length];
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);

  // A long robe flaring to a ragged hem.
  taper(body, 0.2, 0.5, 1.25, [0, 0.95, 0], CLOAK, 7);
  const hem = new T.Group();
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2;
    const length = 0.26 + (i % 3) * 0.04;
    taper(
      hem,
      0.075,
      0,
      length,
      [Math.sin(angle) * 0.44, 0.37 - length / 2, Math.cos(angle) * 0.44],
      SHADOW,
      4,
    ).rotation.y = angle;
  }
  body.add(hem);

  // Thin shins and bony toes showing under the robe.
  const legs = [-1, 1].map((side) => {
    const leg = new T.Group();
    leg.position.set(side * 0.13, 0.78, 0);
    box(leg, [0.09, 0.66, 0.1], [0, -0.35, 0], SHADOW);
    box(leg, [0.11, 0.07, 0.26], [0, -0.745, 0.07], VOID);
    for (const x of [-0.03, 0.03])
      box(leg, [0.025, 0.025, 0.09], [x, -0.765, 0.24], BONE);
    body.add(leg);
    return leg;
  });

  const upper = new T.Group();
  upper.position.set(0, 1.5, 0);
  upper.rotation.x = HUNCH;
  body.add(upper);
  ball(upper, [0.4, 0.17, 0.26], [0, 0.08, 0], CLOAK);
  taper(upper, 0.15, 0.28, 0.2, [0, 0.2, 0], SHADOW, 7);
  const clasp: T.Mesh = ball(
    upper,
    [0.045, 0.045, 0.03],
    [0, 0.1, 0.25],
    eyeColor,
  );
  clasp.material = glow(eyeColor);

  // A deep hood with a bone mask floating in the dark inside it.
  const head = new T.Group();
  head.position.set(0, 0.3, 0.05);
  upper.add(head);
  ball(head, [0.25, 0.29, 0.28], [0, 0.14, 0], CLOAK);
  taper(head, 0, 0.13, 0.3, [0, 0.46, -0.1], CLOAK, 6).rotation.x = -0.55;
  ball(head, [0.18, 0.21, 0.09], [0, 0.12, 0.2], VOID);
  ball(head, [0.14, 0.17, 0.05], [0, 0.11, 0.25], BONE);
  const eyes = [-1, 1].map((side) => {
    const eye = new T.Group();
    eye.position.set(side * 0.055, 0.16, 0.29);
    eye.rotation.z = side * 0.3;
    ball(eye, [0.05, 0.035, 0.012], [0, 0, 0], VOID);
    const light: T.Mesh = ball(
      eye,
      [0.034, 0.025, 0.012],
      [0, 0, 0.012],
      eyeColor,
    );
    light.material = glow(eyeColor);
    head.add(eye);
    return eye;
  });
  box(head, [0.009, 0.09, 0.008], [-0.075, 0.2, 0.285], '#6b6457').rotation.z =
    -0.5;
  box(head, [0.1, 0.012, 0.008], [0, 0.02, 0.292], VOID);
  for (const x of [-0.036, -0.012, 0.012, 0.036])
    box(head, [0.008, 0.042, 0.008], [x, 0.02, 0.297], '#e9e1cc');

  // Long ragged sleeves, bony forearms and claws that curl forward.
  const arms = [-1, 1].map((side) => {
    const arm = new T.Group();
    arm.position.set(side * 0.36, 0.05, 0.02);
    const splay = new T.Group();
    splay.rotation.z = side * 0.14;
    taper(splay, 0.09, 0.13, 0.5, [0, -0.25, 0], CLOAK, 6);
    box(splay, [0.05, 0.42, 0.05], [0, -0.66, 0], BONE);
    ball(splay, [0.055, 0.06, 0.04], [0, -0.89, 0.01], BONE);
    for (const x of [-0.03, 0, 0.03])
      taper(splay, 0.013, 0, 0.17, [x, -1, 0.03], '#efe9da', 4).rotation.x =
        -0.35;
    arm.add(splay);
    upper.add(arm);
    return arm;
  });

  Object.assign(g.userData, {
    body,
    upper,
    head,
    hem,
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
 * Lurches a Hollow along on a dragging leg; standing, it breathes heavily.
 * Every few seconds its head snaps sideways. `time` is in seconds.
 */
export function walkHollow(model: T.Object3D, time: number, walking: boolean) {
  const rig = model.userData as HollowRig;
  const beat = time * 4.2;
  const step = walking ? Math.sin(beat) : 0;
  rig.legL.rotation.x = step * 0.38;
  // The right leg drags: it reaches barely half as far forward as back.
  rig.legR.rotation.x = -step * (step > 0 ? 0.18 : 0.38);
  // The arms dangle a beat behind the stride.
  const dangle = walking ? Math.sin(beat - 0.9) * 0.3 : 0;
  rig.armL.rotation.x = -dangle;
  rig.armR.rotation.x = dangle;
  rig.body.rotation.z = step * 0.07;
  rig.body.position.y = walking ? Math.abs(Math.cos(beat)) * 0.04 : 0;
  rig.upper.rotation.x =
    HUNCH +
    (walking ? Math.sin(2 * beat) * 0.06 : Math.sin(time * 1.1) * 0.025);
  rig.hem.rotation.y = walking
    ? Math.sin(beat) * 0.12
    : Math.sin(time * 0.8) * 0.04;
  const since = time % 2.8;
  const snap =
    since < 0.08 ? since / 0.08 : Math.max(0, 1 - (since - 0.08) / 0.9);
  rig.head.rotation.z = snap * 0.45 + Math.sin(time * 0.7) * 0.05;
  const flicker = 0.8 + 0.2 * Math.sin(time * 17) * Math.sin(time * 5.3);
  for (const eye of rig.eyes) eye.scale.setScalar(flicker);
}
