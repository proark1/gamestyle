import * as T from 'three';
import { box, ball, taper, beam } from '../../shared/rendering/primitives';
import { dressedGameAvatar } from '../../shared/rendering/game-avatar';
import { TEAM, CLOTH } from '../../shared/rendering/palette';
import type { Look } from '../../shared/wardrobe/look';
import { CORNERS, type Boxer } from './types';
import { label } from './signage';
import { createRingside } from './ringside';
import { batchScenery } from '../../shared/rendering/batch-scenery';
import { nextCombo, punchKind, punchProfile, PUNCHES } from './combat';
import { guardFist, punchMotion, type Point } from './punch-motion';
import { TAG_TRANSITION } from './tagging';

export function createRing() {
  const root = new T.Group();
  box(root, [35, 0.3, 30], [0, -0.95, 0], '#9aab95', true);
  box(root, [13.2, 0.65, 10.2], [0, -0.48, 0], '#355a55', true);
  box(root, [12.9, 0.22, 9.9], [0, -0.08, 0], '#eadbb9', true);
  box(root, [11.4, 0.04, 8.6], [0, 0.04, 0], '#779d91', true);
  const center = label('ON THE ROPES', '#e7e4c8', '#779d91', 5.8, 1.15);
  center.rotation.x = -Math.PI / 2;
  center.position.set(0, 0.065, 0);
  root.add(center);
  for (const x of [-5.65, 5.65])
    for (const z of [-4.25, 4.25]) {
      const color =
        x < 0 && z > 0 ? TEAM.red : x > 0 && z < 0 ? TEAM.blue : CLOTH.cream;
      taper(root, 0.15, 0.19, 2.4, [x, 1, z], '#455e55', 12);
      box(root, [0.4, 1.6, 0.4], [x, 1.05, z], color, true);
      ball(root, [0.23, 0.18, 0.23], [x, 2.2, z], '#edc773');
    }
  const ropes: {
    mesh: T.Mesh;
    rest: Float32Array;
    axis: 'x' | 'z';
    side: number;
    height: number;
  }[] = [];
  for (const axis of ['x', 'z'] as const)
    for (const side of [-1, 1])
      for (const height of [0.55, 1.05, 1.55]) {
        const points = Array.from({ length: 25 }, (_, i) =>
          axis === 'x'
            ? new T.Vector3(side * 5.65, height, -4.25 + (i / 24) * 8.5)
            : new T.Vector3(-5.65 + (i / 24) * 11.3, height, side * 4.25),
        );
        const mesh = new T.Mesh(
          new T.TubeGeometry(
            new T.CatmullRomCurve3(points),
            24,
            0.042,
            6,
            false,
          ),
          new T.MeshStandardMaterial({
            roughness: 0.8,
            color:
              height === 1.05 ? '#e6d6ac' : side < 0 ? TEAM.blue : TEAM.red,
          }),
        );
        root.add(mesh);
        ropes.push({
          mesh,
          axis,
          side,
          height,
          rest: new Float32Array(mesh.geometry.attributes.position.array),
        });
      }
  for (const team of ['red', 'blue'] as const) {
    const c = CORNERS[team],
      side = Math.sign(c.x);
    box(root, [1.6, 0.035, 2.2], [c.x, 0.08, c.z], TEAM[team], true);
    const mark = label('TAG', '#fff3d8', TEAM[team], 1, 0.45);
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(c.x, 0.11, c.z);
    root.add(mark);
    box(root, [1.25, 0.15, 3], [side * 6.3, -0.12, c.z], '#c8b997', true);
    taper(root, 0.43, 0.4, 0.17, [side * 7.3, 0.3, c.z], TEAM[team], 16);
    for (const dx of [-0.22, 0.22])
      for (const dz of [-0.22, 0.22])
        beam(
          root,
          [side * 7.3 + dx, 0.25, c.z + dz],
          [side * 7.3 + dx * 1.3, -0.7, c.z + dz * 1.3],
          0.09,
          CLOTH.cream,
        );
    taper(root, 0.28, 0.22, 0.48, [side * 7.3, -0.45, c.z + 1], '#b3c3bb', 12);
    box(root, [0.75, 0.12, 0.5], [side * 7.3, 0.45, c.z], '#f5ecd4', true);
    for (let step = 0; step < 3; step++)
      box(
        root,
        [1.6, 0.2 + step * 0.18, 0.5],
        [side * (7.6 - step * 0.5), -0.7 + step * 0.09, -c.z],
        '#c5b994',
        true,
      );
  }
  const front = label(
    'JUMBLEYARD  /  BOXING CLUB',
    '#f7e9c6',
    '#355a55',
    8,
    0.5,
  );
  front.position.set(0, -0.45, 5.12);
  root.add(front);
  const ringside = createRingside();
  root.add(ringside.root);
  batchScenery(root, [...ropes.map((r) => r.mesh), ringside.root]);
  return { root, ropes, crowd: ringside.crowd };
}

export function createBoxer(p: Boxer, look?: Look) {
  const root = new T.Group();
  const { model } = dressedGameAvatar(
    p.color,
    {
      shirt: TEAM[p.team],
      overalls: TEAM[p.team],
      boots: CLOTH.cream,
      trousers: false,
    },
    look,
  );
  root.add(model);
  const rig = model.userData as Record<string, T.Group>;
  const arms = (['L', 'R'] as const).map((side) => {
    // Only boxing replaces Nico's straight arms with articulated limbs.
    rig[`sleeve${side}`].visible = false;
    const parent = rig[`arm${side}`];
    const upper = ball(parent, [0.065, 0.1, 0.065], [0, -0.1, 0], '#de9268');
    const elbow = ball(parent, [0.067, 0.067, 0.067], [0, -0.2, 0], '#de9268');
    const forearm = ball(parent, [0.064, 0.1, 0.064], [0, -0.3, 0], '#de9268');
    const glove = new T.Group();
    parent.add(glove);
    ball(glove, [0.175, 0.19, 0.2], [0, 0, 0.035], TEAM[p.team], 16);
    box(glove, [0.2, 0.1, 0.22], [0, -0.115, 0], CLOTH.cream, true);
    ball(
      glove,
      [0.07, 0.105, 0.09],
      [side === 'L' ? 0.12 : -0.12, -0.03, 0.055],
      TEAM[p.team],
    );
    return { upper, elbow, forearm, glove, side: side === 'L' ? -1 : 1 };
  });
  const ring = new T.Mesh(
    new T.RingGeometry(0.43, 0.51, 32),
    new T.MeshBasicMaterial({
      color: TEAM[p.team],
      transparent: true,
      opacity: 0.85,
      side: T.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.13;
  root.add(ring);
  const marker = new T.Mesh(
    new T.ConeGeometry(0.12, 0.26, 4),
    new T.MeshBasicMaterial({ color: '#f3ca6b' }),
  );
  marker.rotation.z = Math.PI;
  marker.position.y = 2.4;
  root.add(marker);
  return { root, model, rig, arms, marker, ring, team: p.team };
}
export function poseBoxer(
  visual: ReturnType<typeof createBoxer>,
  p: Boxer,
  time: number,
  reduced: boolean,
) {
  const { rig, model } = visual;
  const moving = Math.min(1, Math.hypot(p.vx, p.vz) / 3);
  const stride = Math.sin(time * 12) * moving;
  model.position.y = p.down
    ? 0.35
    : reduced
      ? 0
      : Math.abs(Math.sin(time * 6)) * 0.035;
  model.rotation.set(
    p.down ? -Math.PI / 2 : p.dodge > 0 ? 0.35 : 0,
    0,
    p.down ? 0.2 : 0,
  );
  rig.body.rotation.set(p.stagger > 0 ? -0.12 : 0.08, 0, 0);
  rig.legL.rotation.set(stride * 0.5, 0, -0.06);
  rig.legR.rotation.set(-stride * 0.5, 0, 0.06);
  rig.armL.rotation.set(p.guarding ? -2.4 : -1.15, 0.1, -0.25);
  rig.armR.rotation.set(p.guarding ? -2.4 : -1.15, -0.1, 0.25);
  if (!p.active) {
    rig.armL.rotation.x = p.input.tag || p.tagRequested ? -2.6 : -0.4;
    rig.armR.rotation.x = p.input.assist
      ? -2 + Math.sin(time * 14) * 0.35
      : -0.4;
    rig.legL.rotation.x = rig.legR.rotation.x = 0;
  }
  const fighting = p.active && !p.down && p.tagTransition === 0;
  if (fighting) {
    rig.armL.rotation.set(0, 0, 0);
    rig.armR.rotation.set(0, 0, 0);
  }
  for (const [index, limb] of visual.arms.entries()) {
    let fist: Point = fighting ? guardFist(limb.side) : [0, -0.39, 0.07];
    if (fighting && p.guarding) fist = [-limb.side * 0.04, 0.3, 0.3];
    if (fighting && p.charge > 0) {
      const charged = p.charge >= 0.45 && p.stamina >= 25;
      const combo = nextCombo(p);
      const nextHand = charged ? 1 - p.hand : combo === 2 ? 1 : 0;
      if (index === nextHand) {
        const kind = charged
          ? 'hook'
          : combo === 3
            ? 'uppercut'
            : combo === 2
              ? 'cross'
              : 'jab';
        fist = punchMotion(
          kind,
          Math.min(p.charge / 0.45, 1) * 0.3 * PUNCHES[kind].windup,
          limb.side,
        ).fist;
      }
    }
    if (fighting && p.attack > 0 && index === p.hand) {
      const motion = punchMotion(
        punchKind(p),
        punchProfile(p).duration - p.attack,
        limb.side,
      );
      fist = motion.fist;
      rig.body.rotation.y =
        limb.side *
        motion.drive *
        (p.heavy ? 0.18 : p.combo === 2 ? 0.12 : 0.05);
      rig.body.rotation.x += motion.drive * (p.combo === 3 ? -0.07 : 0.06);
    }
    const elbow: Point = fighting
      ? [
          fist[0] * 0.45 + limb.side * 0.09,
          fist[1] * 0.45 - 0.16,
          fist[2] * 0.43,
        ]
      : [0, -0.19, 0];
    limb.elbow.position.set(...elbow);
    limb.glove.position.set(...fist);
    limb.glove.rotation.x = fighting ? Math.PI / 2 : 0;
    poseSegment(limb.upper, [0, 0, 0], elbow);
    poseSegment(limb.forearm, elbow, fist);
  }
  if (p.tagTransition > 0 && !reduced) {
    const lift = Math.sin((1 - p.tagTransition / TAG_TRANSITION) * Math.PI);
    model.rotation.x = lift * 0.4;
    rig.legL.rotation.x = -lift * 1.2;
    rig.legR.rotation.x = lift * 0.65;
    rig.armL.rotation.x = -1.6;
    rig.armR.rotation.x = -1.6;
  }
  if (p.down) {
    rig.armL.rotation.set(-0.3, 0, -0.9);
    rig.armR.rotation.set(-0.3, 0, 0.9);
  }
}

const segmentDirection = new T.Vector3();
const segmentUp = new T.Vector3(0, 1, 0);
function poseSegment(mesh: T.Mesh, from: Point, to: Point) {
  mesh.position.set(
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
    (from[2] + to[2]) / 2,
  );
  segmentDirection.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
  mesh.scale.y = segmentDirection.length() / 2 + 0.035;
  mesh.quaternion.setFromUnitVectors(segmentUp, segmentDirection.normalize());
}
